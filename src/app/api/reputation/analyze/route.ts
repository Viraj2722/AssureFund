// app/api/reputation/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Octokit } from '@octokit/rest'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
    try {
        const { wallet_address, github_token } = await req.json()

        if (!wallet_address || !github_token) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        console.log('Starting reputation analysis for:', wallet_address)

        // Initialize GitHub client
        const octokit = new Octokit({ auth: github_token })

        // Fetch GitHub data
        console.log('Fetching GitHub data...')
        const githubData = await fetchGitHubData(octokit)

        // Calculate reputation score
        console.log('Calculating reputation...')
        const reputation = await calculateReputation(githubData)

        // Use Supabase Service Role client (bypasses RLS, no cookies needed)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // Get profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('wallet_address', wallet_address)
            .single()

        if (profileError || !profile) {
            throw new Error('Profile not found')
        }

        console.log('Saving to database...')

        // Save GitHub stats (upsert based on profile_id)
        const { error: statsError } = await supabase
            .from('github_stats')
            .upsert({
                profile_id: profile.id,
                ...githubData.stats,
                analyzed_at: new Date().toISOString()
            }, {
                onConflict: 'profile_id'
            })

        if (statsError) {
            console.error('Error saving stats:', statsError)
        }

        // Save reputation analysis
        const { error: analysisError } = await supabase
            .from('reputation_analysis')
            .insert({
                profile_id: profile.id,
                score: reputation.finalScore,
                trust_level: reputation.trustLevel,
                strengths: reputation.strengths,
                improvements: reputation.improvements,
                reasoning: reputation.reasoning,
                ai_enhanced_score: reputation.aiScore,
                quantitative_score: reputation.baseScore,
                analyzed_at: new Date().toISOString()
            })

        if (analysisError) {
            console.error('Error saving analysis:', analysisError)
        }

        // Update profile with reputation score
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                reputation_score: reputation.finalScore,
                trust_level: reputation.trustLevel,
                last_analyzed_at: new Date().toISOString()
            })
            .eq('id', profile.id)

        if (updateError) {
            console.error('Error updating profile:', updateError)
        }

        console.log('Analysis complete! Score:', reputation.finalScore)

        return NextResponse.json({
            success: true,
            reputation
        })

    } catch (error: any) {
        console.error('Reputation analysis error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to analyze reputation' },
            { status: 500 }
        )
    }
}

async function fetchGitHubData(octokit: Octokit) {
    try {
        // Get authenticated user info
        const { data: user } = await octokit.users.getAuthenticated()
        console.log('Fetched user:', user.login)

        // Get all repositories (including private if token has access)
        const { data: repos } = await octokit.repos.listForAuthenticatedUser({
            per_page: 100,
            sort: 'updated',
            affiliation: 'owner,collaborator,organization_member'
        })
        console.log(`Fetched ${repos.length} repositories`)

        // Calculate repository stats
        const totalStars = repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0)
        const totalForks = repos.reduce((sum, repo) => sum + (repo.forks_count || 0), 0)
        const totalWatchers = repos.reduce((sum, repo) => sum + (repo.watchers_count || 0), 0)

        // Get languages from all repos
        const languages = new Set<string>()
        repos.forEach(repo => {
            if (repo.language) languages.add(repo.language)
        })

        // Get commit count from user's owned repositories
        let totalCommits = 0
        let commitsLastYear = 0
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

        // Get commits from user's own repositories
        const ownedRepos = repos.filter(repo => repo.owner.login === user.login)
        
        for (const repo of ownedRepos.slice(0, 20)) { // Limit to prevent rate limiting
            try {
                const { data: commits } = await octokit.repos.listCommits({
                    owner: repo.owner.login,
                    repo: repo.name,
                    author: user.login,
                    per_page: 100,
                    since: oneYearAgo.toISOString()
                })
                
                commitsLastYear += commits.length
                
                // If we got 100 commits, there might be more
                if (commits.length === 100) {
                    try {
                        const { data: allCommits } = await octokit.repos.listCommits({
                            owner: repo.owner.login,
                            repo: repo.name,
                            author: user.login,
                            per_page: 1
                        })
                        // GitHub's API returns the total count in headers
                        commitsLastYear += 100 // Conservative estimate
                    } catch (e) {
                        console.log('Could not get full commit count for', repo.name)
                    }
                }
            } catch (error) {
                console.log(`Could not fetch commits for ${repo.name}`)
            }
        }

        // Get total commit count from GraphQL API or approximate from activity
        try {
            const { data: contributionData } = await octokit.request('GET /users/{username}/events', {
                username: user.login,
                per_page: 100
            })
            
            const pushEvents = contributionData.filter((e: any) => e.type === 'PushEvent')
            const recentCommits = pushEvents.reduce((sum: number, event: any) => {
                return sum + (event.payload?.commits?.length || 0)
            }, 0)
            
            totalCommits = Math.max(commitsLastYear, recentCommits)
        } catch (error) {
            console.log('Could not fetch events, using repo commit data')
            totalCommits = commitsLastYear
        }

        // Search for user's pull requests
        let totalPRs = 0
        let totalMergedPRs = 0
        try {
            const { data: prsData } = await octokit.search.issuesAndPullRequests({
                q: `author:${user.login} type:pr`,
                per_page: 1
            })
            totalPRs = prsData.total_count

            // Get merged PRs
            const { data: mergedPRsData } = await octokit.search.issuesAndPullRequests({
                q: `author:${user.login} type:pr is:merged`,
                per_page: 1
            })
            totalMergedPRs = mergedPRsData.total_count
        } catch (error) {
            console.error('Error fetching PRs:', error)
        }

        // Search for user's issues
        let totalIssues = 0
        try {
            const { data: issuesData } = await octokit.search.issuesAndPullRequests({
                q: `author:${user.login} type:issue`,
                per_page: 1
            })
            totalIssues = issuesData.total_count
        } catch (error) {
            console.error('Error fetching issues:', error)
        }

        // Get contributions to other repos (reviews, comments, etc.)
        let totalReviews = 0
        let totalIssueComments = 0
        try {
            const { data: events } = await octokit.activity.listPublicEventsForUser({
                username: user.login,
                per_page: 100
            })
            
            totalReviews = events.filter((e: any) => 
                e.type === 'PullRequestReviewEvent' || e.type === 'PullRequestReviewCommentEvent'
            ).length
            
            totalIssueComments = events.filter((e: any) => 
                e.type === 'IssueCommentEvent'
            ).length
        } catch (error) {
            console.error('Error getting contributions:', error)
        }

        // Get contribution activity for the last year
        let contributionsLastYear = 0
        try {
            const { data: events } = await octokit.activity.listPublicEventsForUser({
                username: user.login,
                per_page: 100
            })
            
            contributionsLastYear = events.filter((e: any) => 
                new Date(e.created_at) > oneYearAgo
            ).length
            
            // If we got 100 events, multiply by estimate
            if (events.length === 100) {
                contributionsLastYear = contributionsLastYear * 3.65
            }
        } catch (error) {
            console.error('Error getting contributions:', error)
        }

        // Calculate account age
        const accountCreated = new Date(user.created_at)
        const accountAgeDays = Math.floor(
            (Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Get gists
        let totalGists = 0
        try {
            const { data: gists } = await octokit.gists.list({
                per_page: 1
            })
            totalGists = gists.length
        } catch (error) {
            console.log('Could not fetch gists')
        }

        // Get top repositories with detailed info
        const topRepos = repos
            .filter(r => !r.fork) // Exclude forked repos
            .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
            .slice(0, 5)
            .map(r => ({
                name: r.name,
                stars: r.stargazers_count || 0,
                forks: r.forks_count || 0,
                watchers: r.watchers_count || 0,
                language: r.language,
                description: r.description,
                is_fork: r.fork,
                open_issues: r.open_issues_count || 0,
                size: r.size || 0,
                created_at: r.created_at,
                updated_at: r.updated_at
            }))

        // Calculate quality metrics
        const forkedRepos = repos.filter(r => r.fork).length
        const originalRepos = repos.length - forkedRepos
        const activeRepos = repos.filter(r => {
            const lastUpdate = new Date(r.updated_at)
            const sixMonthsAgo = new Date()
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
            return lastUpdate > sixMonthsAgo
        }).length

        const stats = {
            // Core metrics
            total_repos: repos.length,
            original_repos: originalRepos,
            forked_repos: forkedRepos,
            active_repos: activeRepos,
            
            // Popularity metrics
            total_stars: totalStars,
            total_forks: totalForks,
            total_watchers: totalWatchers,
            
            // Activity metrics
            total_commits: totalCommits,
            commits_last_year: commitsLastYear,
            total_prs: totalPRs,
            merged_prs: totalMergedPRs,
            total_issues: totalIssues,
            total_reviews: totalReviews,
            total_issue_comments: totalIssueComments,
            total_gists: totalGists,
            
            // Contribution metrics
            contributions_last_year: Math.round(contributionsLastYear),
            
            // Profile metrics
            account_age_days: accountAgeDays,
            followers: user.followers || 0,
            following: user.following || 0,
            
            // Technical profile
            languages: Array.from(languages),
            total_languages: languages.size,
            
            // Calculated metrics
            stars_per_repo: repos.length > 0 ? (totalStars / repos.length).toFixed(2) : 0,
            pr_merge_rate: totalPRs > 0 ? ((totalMergedPRs / totalPRs) * 100).toFixed(1) : 0
        }

        console.log('GitHub Stats:', stats)

        return {
            user,
            stats,
            topRepos
        }
    } catch (error) {
        console.error('Error fetching GitHub data:', error)
        throw error
    }
}

async function calculateReputation(githubData: any) {
    const stats = githubData.stats
    const topRepos = githubData.topRepos

    // Quantitative base score (0-100)
    let baseScore = 0
    const breakdown = {
        accountAge: 0,
        repoQuality: 0,
        activity: 0,
        community: 0,
        consistency: 0
    }

    // 1. Account Age & Longevity (max 15 points)
    const accountYears = stats.account_age_days / 365
    breakdown.accountAge = Math.min(accountYears * 5, 15)
    baseScore += breakdown.accountAge

    // 2. Repository Quality (max 25 points)
    // Original repos matter more than forks
    breakdown.repoQuality += Math.min(stats.original_repos * 0.8, 12)
    // Stars indicate quality and impact
    breakdown.repoQuality += Math.min(stats.total_stars * 0.15, 8)
    // Active maintenance shows commitment
    breakdown.repoQuality += Math.min(stats.active_repos * 0.5, 5)
    baseScore += breakdown.repoQuality

    // 3. Coding Activity (max 30 points)
    // Commits show consistent work
    breakdown.activity += Math.min(stats.commits_last_year * 0.05, 15)
    // PRs show collaboration
    breakdown.activity += Math.min(stats.total_prs * 0.4, 10)
    // PR merge rate shows quality
    breakdown.activity += Math.min(parseFloat(stats.pr_merge_rate as string) * 0.05, 5)
    baseScore += breakdown.activity

    // 4. Community Engagement (max 20 points)
    // Issues show problem-solving
    breakdown.community += Math.min(stats.total_issues * 0.2, 5)
    // Reviews show expertise sharing
    breakdown.community += Math.min(stats.total_reviews * 0.3, 6)
    // Followers indicate reputation
    breakdown.community += Math.min(stats.followers * 0.15, 6)
    // Comments show community participation
    breakdown.community += Math.min(stats.total_issue_comments * 0.1, 3)
    baseScore += breakdown.community

    // 5. Consistency & Impact (max 10 points)
    // Recent contributions
    breakdown.consistency += Math.min(stats.contributions_last_year * 0.03, 5)
    // Language diversity
    breakdown.consistency += Math.min(stats.total_languages * 0.5, 5)
    baseScore += breakdown.consistency

    baseScore = Math.min(Math.round(baseScore), 100)

    console.log('Base Score Breakdown:', breakdown)
    console.log('Total Base Score:', baseScore)

    // AI-Enhanced Analysis
    let aiScore = baseScore
    let aiInsights = {
        score: baseScore,
        strengths: [] as string[],
        improvements: [] as string[],
        reasoning: ''
    }

    if (process.env.GEMINI_API_KEY) {
        try {
            console.log('Running Gemini AI analysis...')
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
            
            const modelNames = [
                'gemini-1.5-pro',
                'gemini-1.5-flash',
                'gemini-pro',
            ]
            
            let model
            
            for (const modelName of modelNames) {
                try {
                    model = genAI.getGenerativeModel({ model: modelName })
                    console.log(`Using model: ${modelName}`)
                    break
                } catch (e) {
                    console.log(`Model ${modelName} not available, trying next...`)
                }
            }

            if (!model) {
                throw new Error('No Gemini model available')
            }

            const prompt = `You are an expert developer reputation analyst. Analyze this GitHub profile and provide a comprehensive assessment.

DEVELOPER PROFILE SUMMARY:
════════════════════════════════════════════════════════
Username: ${githubData.user.login}
Account Age: ${(stats.account_age_days / 365).toFixed(1)} years (${stats.account_age_days} days)
Bio: ${githubData.user.bio || 'No bio provided'}

REPOSITORY METRICS:
────────────────────────────────────────────────────────
• Total Repositories: ${stats.total_repos} (${stats.original_repos} original, ${stats.forked_repos} forked)
• Active Repositories (6mo): ${stats.active_repos}
• Total Stars Received: ${stats.total_stars} (${stats.stars_per_repo} avg/repo)
• Total Forks: ${stats.total_forks}
• Total Watchers: ${stats.total_watchers}

ACTIVITY & CONTRIBUTIONS:
────────────────────────────────────────────────────────
• Commits (Last Year): ${stats.commits_last_year}
• Total Pull Requests: ${stats.total_prs} (${stats.merged_prs} merged - ${stats.pr_merge_rate}% merge rate)
• Issues Created: ${stats.total_issues}
• Code Reviews: ${stats.total_reviews}
• Issue Comments: ${stats.total_issue_comments}
• Public Gists: ${stats.total_gists}
• Contributions (Last Year): ${stats.contributions_last_year}

COMMUNITY IMPACT:
────────────────────────────────────────────────────────
• Followers: ${stats.followers}
• Following: ${stats.following}
• Programming Languages: ${stats.total_languages} (${stats.languages.slice(0, 5).join(', ')})

TOP PROJECTS:
────────────────────────────────────────────────────────
${topRepos.map((repo, i) => `${i + 1}. ${repo.name} - ⭐ ${repo.stars} stars, 🔀 ${repo.forks} forks
   Language: ${repo.language || 'N/A'}
   ${repo.description ? `Description: ${repo.description}` : 'No description'}`).join('\n')}

QUANTITATIVE BASE SCORE: ${baseScore}/100

ANALYSIS INSTRUCTIONS:
════════════════════════════════════════════════════════
Evaluate this developer and assign a reputation score (0-100).

SCORING GUIDELINES:
• 0-29: Novice - Limited activity, learning phase
• 30-49: Contributor - Regular activity, some quality work
• 50-69: Established - Consistent contributions, recognized projects
• 70-84: Trusted - Strong track record, community respect
• 85-100: Elite - Industry leader, significant impact

Return ONLY valid JSON (no markdown, no code blocks):
{
  "score": <number 0-100>,
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "improvements": ["<actionable improvement 1>", "<actionable improvement 2>"],
  "reasoning": "<2-3 sentences explaining the score>"
}`

            const result = await model.generateContent(prompt)
            const response = await result.response
            const text = response.text()
            
            console.log('Gemini Response:', text.substring(0, 200) + '...')
            
            const jsonMatch = text.match(/\{[\s\S]*\}/)
            
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0])
                aiInsights = {
                    score: parsed.score || baseScore,
                    strengths: parsed.strengths || [],
                    improvements: parsed.improvements || [],
                    reasoning: parsed.reasoning || ''
                }
                aiScore = aiInsights.score
                console.log('AI Score:', aiScore)
                console.log('AI Analysis successful!')
            } else {
                console.warn('Could not extract JSON from Gemini response')
            }
        } catch (error: any) {
            console.error('AI analysis error:', error.message)
            console.log('Falling back to base score only')
        }
    } else {
        console.log('Gemini API key not found, using base score only')
    }

    // Final score calculation: 70% quantitative, 30% AI
    const finalScore = Math.round(baseScore * 0.7 + aiScore * 0.3)

    // Determine trust level
    let trustLevel = 'novice'
    if (finalScore >= 85) trustLevel = 'elite'
    else if (finalScore >= 70) trustLevel = 'trusted'
    else if (finalScore >= 50) trustLevel = 'established'
    else if (finalScore >= 30) trustLevel = 'contributor'

    // Generate defaults if AI didn't provide
    const strengths = aiInsights.strengths.length > 0 
        ? aiInsights.strengths 
        : generateDefaultStrengths(stats, topRepos)
    
    const improvements = aiInsights.improvements.length > 0 
        ? aiInsights.improvements 
        : generateDefaultImprovements(stats)

    const reasoning = aiInsights.reasoning || generateDefaultReasoning(stats, baseScore, finalScore)

    console.log('Final Score:', finalScore)
    console.log('Trust Level:', trustLevel)

    return {
        finalScore,
        baseScore,
        aiScore,
        trustLevel,
        strengths,
        improvements,
        reasoning,
        breakdown
    }
}

function generateDefaultStrengths(stats: any, topRepos: any[]): string[] {
    const strengths: string[] = []
    
    if (stats.original_repos > 15) {
        strengths.push(`Prolific creator with ${stats.original_repos} original repositories`)
    }
    if (stats.total_stars > 50) {
        strengths.push(`Strong community recognition with ${stats.total_stars} stars across projects`)
    }
    if (stats.merged_prs > 20) {
        strengths.push(`Effective collaborator with ${stats.merged_prs} merged pull requests`)
    }
    if (parseFloat(stats.pr_merge_rate as string) > 70) {
        strengths.push(`High-quality contributions (${stats.pr_merge_rate}% PR merge rate)`)
    }
    if (stats.account_age_days > 730) {
        strengths.push(`Long-term commitment (${(stats.account_age_days / 365).toFixed(1)} years on GitHub)`)
    }
    if (stats.total_languages > 5) {
        strengths.push(`Versatile developer with ${stats.total_languages} programming languages`)
    }
    if (stats.total_reviews > 20) {
        strengths.push(`Active code reviewer contributing to code quality`)
    }
    if (topRepos[0]?.stars > 20) {
        strengths.push(`Successful project: "${topRepos[0].name}" with ${topRepos[0].stars} stars`)
    }
    if (stats.active_repos / Math.max(stats.total_repos, 1) > 0.5) {
        strengths.push(`Maintains active projects (${stats.active_repos} actively updated repos)`)
    }
    
    return strengths.slice(0, 5)
}

function generateDefaultImprovements(stats: any): string[] {
    const improvements: string[] = []
    
    if (stats.commits_last_year < 100) {
        improvements.push('Increase commit frequency and consistency')
    }
    if (stats.total_prs < 20) {
        improvements.push('Engage more in open-source collaboration via pull requests')
    }
    if (stats.followers < 30) {
        improvements.push('Build community presence through networking and knowledge sharing')
    }
    if (stats.total_stars < 50) {
        improvements.push('Focus on creating high-impact, quality projects that solve real problems')
    }
    if (stats.total_reviews < 10) {
        improvements.push('Participate in code reviews to demonstrate expertise and help others')
    }
    if (stats.original_repos < 10) {
        improvements.push('Create more original repositories to showcase technical skills')
    }
    if (parseFloat(stats.pr_merge_rate as string) < 50 && stats.total_prs > 5) {
        improvements.push('Improve PR quality to increase merge rate')
    }
    
    return improvements.slice(0, 3)
}

function generateDefaultReasoning(stats: any, baseScore: number, finalScore: number): string {
    const accountYears = (stats.account_age_days / 365).toFixed(1)
    const quality = baseScore >= 60 ? 'strong' : baseScore >= 40 ? 'moderate' : 'developing'
    return `Developer with ${accountYears} years of GitHub activity, maintaining ${stats.original_repos} original repositories with ${stats.total_stars} total stars. Shows ${quality} presence through ${stats.commits_last_year} commits and ${stats.total_prs} pull requests in the last year. Community engagement reflected in ${stats.followers} followers and ${stats.pr_merge_rate}% PR merge rate.`
}