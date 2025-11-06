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

        // Check if stats record exists
        const { data: existingStats } = await supabase
            .from('github_stats')
            .select('id')
            .eq('profile_id', profile.id)
            .single()

        // Prepare stats data
        const statsData = {
            profile_id: profile.id,
            total_repos: githubData.stats.total_repos,
            total_stars: githubData.stats.total_stars, // Stars received
            total_forks: githubData.stats.total_forks,
            total_commits: githubData.stats.total_commits,
            total_prs: githubData.stats.total_prs,
            total_issues: githubData.stats.total_issues,
            contributions_last_year: githubData.stats.contributions_last_year,
            account_age_days: githubData.stats.account_age_days,
            followers: githubData.stats.followers,
            following: githubData.stats.following,
            languages: githubData.stats.languages,
            analyzed_at: new Date().toISOString()
        }

        // Update or insert based on existence
        if (existingStats) {
            const { error: statsError } = await supabase
                .from('github_stats')
                .update(statsData)
                .eq('profile_id', profile.id)
            
            if (statsError) {
                console.error('Error updating stats:', statsError)
            }
        } else {
            const { error: statsError } = await supabase
                .from('github_stats')
                .insert(statsData)
            
            if (statsError) {
                console.error('Error inserting stats:', statsError)
            }
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
            reputation,
            stats: githubData.stats
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

        // Get all repositories (both public and private) like GitHub UI shows
        const allReposResponse = await octokit.repos.listForAuthenticatedUser({
            per_page: 100,
            sort: 'updated',
            affiliation: 'owner' // Only repos owned by the user (not collaborator repos)
        })
        
        const repos = allReposResponse.data
        console.log(`Fetched ${repos.length} public repositories`)

        // Calculate repository stats (stars RECEIVED by user's repos)
        const totalStarsReceived = repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0)
        const totalForks = repos.reduce((sum, repo) => sum + (repo.forks_count || 0), 0)
        const totalWatchers = repos.reduce((sum, repo) => sum + (repo.watchers_count || 0), 0)
        
        // Get starred repositories (repos user has STARRED)
        let totalStarsGiven = 0
        try {
            const { data: starredRepos } = await octokit.activity.listReposStarredByAuthenticatedUser({
                per_page: 100
            })
            totalStarsGiven = starredRepos.length
            console.log(`User has starred ${totalStarsGiven} repositories`)
        } catch (error) {
            console.log('Could not fetch starred repos')
        }

        // Get languages from all repos
        const languages = new Set<string>()
        repos.forEach(repo => {
            if (repo.language) languages.add(repo.language)
        })

        // Calculate dates
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
        
        const accountCreated = new Date(user.created_at)
        const accountAgeDays = Math.floor(
            (Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Use GraphQL to get accurate contribution stats
        let totalCommits = 0
        let contributionsLastYear = 0
        let totalPRContributions = 0
        let totalIssueContributions = 0
        let totalReviewContributions = 0
        
        try {
            const graphqlQuery = `
                query($username: String!) {
                    user(login: $username) {
                        contributionsCollection {
                            contributionCalendar {
                                totalContributions
                            }
                            totalCommitContributions
                            totalIssueContributions
                            totalPullRequestContributions
                            totalPullRequestReviewContributions
                        }
                    }
                }
            `
            
            const graphqlResult: any = await octokit.graphql(graphqlQuery, {
                username: user.login
            })
            
            const contributions = graphqlResult.user.contributionsCollection
            totalCommits = contributions.totalCommitContributions
            contributionsLastYear = contributions.contributionCalendar.totalContributions
            totalIssueContributions = contributions.totalIssueContributions
            totalPRContributions = contributions.totalPullRequestContributions
            totalReviewContributions = contributions.totalPullRequestReviewContributions
            
            console.log('GraphQL Contributions:', {
                totalCommits,
                totalContributions: contributionsLastYear,
                issues: totalIssueContributions,
                prs: totalPRContributions,
                reviews: totalReviewContributions
            })
        } catch (error) {
            console.error('GraphQL query failed:', error)
            
            // Fallback to REST API
            try {
                const { data: events } = await octokit.activity.listPublicEventsForUser({
                    username: user.login,
                    per_page: 100
                })
                
                const pushEvents = events.filter((e: any) => e.type === 'PushEvent')
                totalCommits = pushEvents.reduce((sum: number, event: any) => {
                    return sum + (event.payload?.commits?.length || 0)
                }, 0) * 4 // Estimate for the year
                
                contributionsLastYear = events.filter((e: any) => 
                    new Date(e.created_at) > oneYearAgo
                ).length * 4
            } catch (fallbackError) {
                console.error('Fallback failed:', fallbackError)
                totalCommits = 0
                contributionsLastYear = 0
            }
        }

        // Get PR statistics - use GraphQL data if available, otherwise search
        let totalPRs = totalPRContributions || 0
        let mergedPRs = 0
        
        if (totalPRs === 0) {
            try {
                const prsQuery = `author:${user.login} type:pr`
                const { data: prsData } = await octokit.rest.search.issuesAndPullRequests({
                    q: prsQuery,
                    per_page: 1
                })
                totalPRs = prsData.total_count

                const mergedQuery = `author:${user.login} type:pr is:merged`
                const { data: mergedPRsData } = await octokit.rest.search.issuesAndPullRequests({
                    q: mergedQuery,
                    per_page: 1
                })
                mergedPRs = mergedPRsData.total_count
            } catch (error) {
                console.error('Error fetching PR stats:', error)
            }
        } else {
            // Estimate merged PRs (typically 60-70% for active developers)
            try {
                const mergedQuery = `author:${user.login} type:pr is:merged`
                const { data: mergedPRsData } = await octokit.rest.search.issuesAndPullRequests({
                    q: mergedQuery,
                    per_page: 1
                })
                mergedPRs = mergedPRsData.total_count
            } catch (error) {
                mergedPRs = Math.round(totalPRs * 0.65)
            }
        }

        // Get issues statistics - use GraphQL data if available
        let totalIssues = totalIssueContributions || 0
        
        if (totalIssues === 0) {
            try {
                const issuesQuery = `author:${user.login} type:issue`
                const { data: issuesData } = await octokit.rest.search.issuesAndPullRequests({
                    q: issuesQuery,
                    per_page: 1
                })
                totalIssues = issuesData.total_count
            } catch (error) {
                console.error('Error fetching issues:', error)
            }
        }

        // Reviews from GraphQL
        const totalReviews = totalReviewContributions || 0

        console.log('PR Stats:', { totalPRs, mergedPRs })
        console.log('Total Issues:', totalIssues)
        console.log('Total Reviews:', totalReviews)

        // Get gists
        let totalGists = 0
        try {
            const { data: gists } = await octokit.rest.gists.list({
                per_page: 100
            })
            totalGists = gists.length
        } catch (error) {
            console.log('Could not fetch gists')
        }

        // Calculate quality metrics
        const forkedRepos = repos.filter(r => r.fork).length
        const originalRepos = repos.length - forkedRepos
        
        const activeRepos = repos.filter(r => {
            const lastUpdate = new Date(r.updated_at)
            const sixMonthsAgo = new Date()
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
            return lastUpdate > sixMonthsAgo
        }).length

        // Get top repositories
        const topRepos = repos
            .filter(r => !r.fork)
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
                created_at: r.created_at,
                updated_at: r.updated_at
            }))

        // Build comprehensive stats object
        const stats = {
            // Core metrics - matching GitHub UI
            total_repos: repos.length,
            original_repos: originalRepos,
            forked_repos: forkedRepos,
            active_repos: activeRepos,
            
            // Popularity metrics
            total_stars: totalStarsReceived, // Stars received by user's repos
            total_stars_given: totalStarsGiven, // Repos user has starred (the "Stars: 9" in GitHub UI)
            total_forks: totalForks,
            total_watchers: totalWatchers,
            
            // Activity metrics - from GraphQL
            total_commits: totalCommits,
            commits_last_year: totalCommits,
            total_prs: totalPRs,
            merged_prs: mergedPRs,
            total_issues: totalIssues,
            total_reviews: totalReviews,
            total_issue_comments: 0, // Not available in GraphQL
            total_gists: totalGists,
            
            // Contribution metrics
            contributions_last_year: contributionsLastYear,
            
            // Profile metrics
            account_age_days: accountAgeDays,
            followers: user.followers || 0,
            following: user.following || 0,
            
            // Technical profile
            languages: Array.from(languages),
            total_languages: languages.size,
            
            // Calculated metrics
            stars_per_repo: repos.length > 0 ? parseFloat((totalStarsReceived / repos.length).toFixed(2)) : 0,
            pr_merge_rate: totalPRs > 0 ? parseFloat(((mergedPRs / totalPRs) * 100).toFixed(1)) : 0
        }

        console.log('Final GitHub Stats:', stats)

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
    breakdown.repoQuality += Math.min(stats.original_repos * 0.8, 12)
    breakdown.repoQuality += Math.min(stats.total_stars * 0.15, 8)
    breakdown.repoQuality += Math.min(stats.active_repos * 0.5, 5)
    baseScore += breakdown.repoQuality

    // 3. Coding Activity (max 30 points)
    breakdown.activity += Math.min(stats.total_commits * 0.05, 15)
    breakdown.activity += Math.min(stats.total_prs * 0.4, 10)
    breakdown.activity += Math.min(stats.pr_merge_rate * 0.05, 5)
    baseScore += breakdown.activity

    // 4. Community Engagement (max 20 points)
    breakdown.community += Math.min(stats.total_issues * 0.2, 5)
    breakdown.community += Math.min(stats.total_reviews * 0.3, 6)
    breakdown.community += Math.min(stats.followers * 0.15, 6)
    breakdown.community += Math.min(stats.total_issue_comments * 0.1, 3)
    baseScore += breakdown.community

    // 5. Consistency & Impact (max 10 points)
    breakdown.consistency += Math.min(stats.contributions_last_year * 0.03, 5)
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
            
            // Try available models in order of preference
            const modelNames = [
                'gemini-2.0-flash-exp',  // Latest experimental
                'gemini-1.5-flash',       // Stable fallback
                'gemini-1.5-pro',         // Pro version
            ]
            
            let model = null
            let workingModelName = ''
            
            for (const modelName of modelNames) {
                try {
                    model = genAI.getGenerativeModel({ model: modelName })
                    // Try a test generation to verify it works
                    console.log(`Trying model: ${modelName}`)
                    workingModelName = modelName
                    break
                } catch (e) {
                    console.log(`Model ${modelName} not available, trying next...`)
                }
            }
            
            if (!model) {
                throw new Error('No Gemini model available')
            }
            
            console.log(`Using model: ${workingModelName}`)

            const prompt = `You are an expert developer reputation analyst. Analyze this GitHub profile and provide a comprehensive assessment.

DEVELOPER PROFILE:
Username: ${githubData.user.login}
Account Age: ${(stats.account_age_days / 365).toFixed(1)} years
Bio: ${githubData.user.bio || 'No bio provided'}

REPOSITORY METRICS:
• Total Repositories: ${stats.total_repos} (${stats.original_repos} original)
• Active Repositories: ${stats.active_repos}
• Total Stars: ${stats.total_stars}
• Total Forks: ${stats.total_forks}

ACTIVITY & CONTRIBUTIONS:
• Total Commits: ${stats.total_commits}
• Pull Requests: ${stats.total_prs} (${stats.merged_prs} merged - ${stats.pr_merge_rate}% merge rate)
• Issues: ${stats.total_issues}
• Code Reviews: ${stats.total_reviews}
• Contributions (Last Year): ${stats.contributions_last_year}

COMMUNITY:
• Followers: ${stats.followers}
• Languages: ${stats.languages.slice(0, 5).join(', ')}

BASE SCORE: ${baseScore}/100

Evaluate this developer (0-100). 0-29: Novice, 30-49: Contributor, 50-69: Established, 70-84: Trusted, 85-100: Elite.

Return ONLY valid JSON:
{
  "score": <number>,
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "reasoning": "<2-3 sentences>"
}`

            const result = await model.generateContent(prompt)
            const response = await result.response
            const text = response.text()
            
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
            }
        } catch (error: any) {
            console.error('AI analysis error:', error.message)
            console.log('Continuing without AI enhancement - base score will be used')
            // AI analysis is optional, continue with base score
        }
    } else {
        console.log('Gemini API key not configured - using base score only')
    }

    // Final score calculation
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
    if (stats.total_commits > 200) {
        strengths.push(`Active contributor with ${stats.total_commits} commits`)
    }
    if (stats.account_age_days > 730) {
        strengths.push(`Long-term commitment (${(stats.account_age_days / 365).toFixed(1)} years)`)
    }
    if (stats.total_languages > 5) {
        strengths.push(`Versatile developer with ${stats.total_languages} languages`)
    }
    if (stats.total_stars > 50) {
        strengths.push(`Strong community recognition with ${stats.total_stars} stars`)
    }
    if (stats.merged_prs > 20) {
        strengths.push(`Effective collaborator with ${stats.merged_prs} merged PRs`)
    }
    if (stats.pr_merge_rate > 70) {
        strengths.push(`High-quality contributions (${stats.pr_merge_rate}% PR merge rate)`)
    }
    if (topRepos[0]?.stars > 10) {
        strengths.push(`Successful project: "${topRepos[0].name}" with ${topRepos[0].stars} stars`)
    }
    
    return strengths.slice(0, 5)
}

function generateDefaultImprovements(stats: any): string[] {
    const improvements: string[] = []
    
    if (stats.total_commits < 100) {
        improvements.push('Increase commit frequency and consistency')
    }
    if (stats.total_prs < 20) {
        improvements.push('Engage more in open-source collaboration')
    }
    if (stats.followers < 30) {
        improvements.push('Build community presence through networking')
    }
    if (stats.total_stars < 50) {
        improvements.push('Focus on creating high-impact projects')
    }
    if (stats.total_reviews < 10) {
        improvements.push('Participate more in code reviews')
    }
    
    return improvements.slice(0, 3)
}

function generateDefaultReasoning(stats: any, baseScore: number, finalScore: number): string {
    const accountYears = (stats.account_age_days / 365).toFixed(1)
    const quality = baseScore >= 60 ? 'strong' : baseScore >= 40 ? 'moderate' : 'developing'
    return `Developer with ${accountYears} years of GitHub activity, maintaining ${stats.original_repos} original repositories with ${stats.total_stars} total stars. Shows ${quality} presence through ${stats.total_commits} commits and ${stats.total_prs} pull requests. Community engagement reflected in ${stats.followers} followers and ${stats.pr_merge_rate}% PR merge rate.`
}