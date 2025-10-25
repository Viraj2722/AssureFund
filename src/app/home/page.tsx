"use client"
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useWallet } from '@solana/wallet-adapter-react';
import { Github, Star, GitFork, GitPullRequest, Users, RefreshCw, Sparkles, LogOut, User, Home, FolderGit2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Homepage() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); // 'home' or 'profile'
  const supabase = createClientComponentClient();
  const { publicKey, disconnect } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (publicKey) {
      loadProfileData();
    } else {
      // If no wallet connected, redirect to landing
      router.push('/');
    }
  }, [publicKey]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const walletAddress = publicKey?.toString();

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      if (profileError) {
        console.error('Profile not found, redirecting to landing');
        router.push('/');
        return;
      }
      
      setProfile(profileData);

      // Fetch GitHub stats
      const { data: statsData } = await supabase
        .from('github_stats')
        .select('*')
        .eq('profile_id', profileData.id)
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .single();

      setStats(statsData);

      // Fetch reputation analysis
      const { data: analysisData } = await supabase
        .from('reputation_analysis')
        .select('*')
        .eq('profile_id', profileData.id)
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .single();

      setAnalysis(analysisData);

    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!profile?.github_access_token) {
      alert('GitHub not connected. Please reconnect your GitHub account.');
      return;
    }

    setRefreshing(true);
    try {
      const response = await fetch('/api/reputation/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: publicKey?.toString(),
          github_token: profile?.github_access_token
        })
      });

      if (response.ok) {
        await loadProfileData();
      } else {
        const error = await response.json();
        alert(`Failed to refresh: ${error.error}`);
      }
    } catch (error) {
      console.error('Refresh error:', error);
      alert('Failed to refresh reputation');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Disconnect wallet
      await disconnect();
      
      // Redirect to landing page
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'from-green-500 to-emerald-600';
    if (score >= 60) return 'from-blue-500 to-cyan-600';
    if (score >= 40) return 'from-yellow-500 to-orange-600';
    return 'from-red-500 to-pink-600';
  };

  const getTrustLevelBadge = (level) => {
    const badges = {
      elite: { label: 'Elite', color: 'bg-gradient-to-r from-yellow-400 to-amber-500', icon: '👑' },
      trusted: { label: 'Trusted', color: 'bg-gradient-to-r from-purple-500 to-indigo-600', icon: '⭐' },
      established: { label: 'Established', color: 'bg-gradient-to-r from-green-500 to-emerald-600', icon: '✓' },
      contributor: { label: 'Contributor', color: 'bg-gradient-to-r from-blue-500 to-cyan-600', icon: '🔵' },
      novice: { label: 'Novice', color: 'bg-gradient-to-r from-gray-500 to-slate-600', icon: '🌱' }
    };
    return badges[level] || badges.novice;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-zinc-900 mx-auto"></div>
          <p className="text-zinc-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-zinc-600">Profile not found. Redirecting...</p>
        </div>
      </div>
    );
  }

  const badge = getTrustLevelBadge(profile.trust_level);
  const score = profile.reputation_score || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img src="/Brand-Light.png" alt="AssureFund" className="h-10 w-10" />
              <span className="text-xl font-bold text-zinc-900">AssureFund</span>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('home')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === 'home'
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                <Home className="w-4 h-4" />
                Home
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === 'profile'
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                <User className="w-4 h-4" />
                Profile
              </button>
            </div>

            {/* User Actions */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-zinc-900">
                  {profile.github_username || 'User'}
                </div>
                <div className="text-xs text-zinc-500">
                  {publicKey?.toString().slice(0, 4)}...{publicKey?.toString().slice(-4)}
                </div>
              </div>
              {profile.github_avatar_url && (
                <img
                  src={profile.github_avatar_url}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border-2 border-zinc-200"
                />
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'home' ? (
          /* HOME TAB - Project Listing */
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold text-zinc-900">
                Discover Projects
              </h1>
              <p className="text-zinc-600">Fund innovative projects from verified developers</p>
            </div>

            {/* Quick Stats Bar */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="grid grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-zinc-900">{Math.round(score)}</div>
                  <div className="text-sm text-zinc-500">Your Reputation</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-zinc-900">0</div>
                  <div className="text-sm text-zinc-500">Projects Posted</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-zinc-900">0</div>
                  <div className="text-sm text-zinc-500">Funded</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-zinc-900">0</div>
                  <div className="text-sm text-zinc-500">Backed</div>
                </div>
              </div>
            </div>

            {/* Coming Soon */}
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <FolderGit2 className="w-16 h-16 text-zinc-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-zinc-900 mb-2">Projects Coming Soon</h2>
              <p className="text-zinc-600">Start building your reputation. Projects will appear here.</p>
            </div>
          </div>
        ) : (
          /* PROFILE TAB - Full GitHub Profile */
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold text-zinc-900">
                Your Developer Profile
              </h1>
              <p className="text-zinc-600">Your reputation opens doors to funding opportunities</p>
            </div>

            {/* Main Profile Card */}
            <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-12">
                {/* Left: Reputation Score */}
                <div className="flex flex-col items-center justify-center space-y-6">
                  <div className="relative">
                    <div className={`w-48 h-48 rounded-full bg-gradient-to-br ${getScoreColor(score)} p-1 shadow-2xl`}>
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-6xl font-bold text-zinc-900">{Math.round(score)}</div>
                          <div className="text-sm text-zinc-500 mt-1">Reputation</div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute -top-2 -right-2">
                      <Sparkles className="w-10 h-10 text-yellow-500 animate-pulse" />
                    </div>
                  </div>

                  <div className={`${badge.color} text-white px-6 py-3 rounded-full font-semibold text-lg shadow-lg flex items-center gap-2`}>
                    <span>{badge.icon}</span>
                    <span>{badge.label}</span>
                  </div>

                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-6 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-sm font-medium text-zinc-700 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Updating...' : 'Refresh Score'}
                  </button>
                </div>

                {/* Right: Profile Info */}
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    {profile.github_avatar_url && (
                      <img
                        src={profile.github_avatar_url}
                        alt="GitHub Avatar"
                        className="w-20 h-20 rounded-full border-4 border-zinc-200"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <Github className="w-5 h-5 text-zinc-600" />
                        <a
                          href={`https://github.com/${profile.github_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-2xl font-bold text-zinc-900 hover:text-zinc-600 transition"
                        >
                          {profile.github_username}
                        </a>
                      </div>
                      <p className="text-sm text-zinc-500 mt-1">
                        Wallet: {profile.wallet_address.slice(0, 6)}...{profile.wallet_address.slice(-4)}
                      </p>
                    </div>
                  </div>

                  {analysis && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-zinc-900 mb-3">💪 Your Strengths</h3>
                        <div className="space-y-2">
                          {analysis.strengths.map((strength, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5"></div>
                              <span className="text-zinc-700">{strength}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {analysis.improvements && analysis.improvements.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-zinc-900 mb-3">🎯 Areas to Improve</h3>
                          <div className="space-y-2">
                            {analysis.improvements.map((improvement, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5"></div>
                                <span className="text-zinc-700">{improvement}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {analysis.reasoning && (
                        <div className="mt-4 p-4 bg-zinc-50 rounded-xl">
                          <h3 className="text-sm font-semibold text-zinc-900 mb-2">📊 Analysis Summary</h3>
                          <p className="text-sm text-zinc-700">{analysis.reasoning}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* GitHub Stats Grid */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={<GitFork className="w-6 h-6" />}
                  label="Repositories"
                  value={stats.total_repos}
                  color="blue"
                />
                <StatCard
                  icon={<Star className="w-6 h-6" />}
                  label="Total Stars"
                  value={stats.total_stars}
                  color="yellow"
                />
                <StatCard
                  icon={<GitPullRequest className="w-6 h-6" />}
                  label="Pull Requests"
                  value={stats.total_prs}
                  color="purple"
                />
                <StatCard
                  icon={<Users className="w-6 h-6" />}
                  label="Followers"
                  value={stats.followers}
                  color="green"
                />
              </div>
            )}

            {/* Additional Stats */}
            {stats && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-zinc-900 mb-6">Activity Overview</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-3xl font-bold text-zinc-900">{stats.total_commits}</div>
                    <div className="text-sm text-zinc-500">Commits (Last Year)</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-zinc-900">{stats.total_issues}</div>
                    <div className="text-sm text-zinc-500">Issues Created</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-zinc-900">
                      {Math.floor(stats.account_age_days / 365)}y {Math.floor((stats.account_age_days % 365) / 30)}m
                    </div>
                    <div className="text-sm text-zinc-500">Account Age</div>
                  </div>
                </div>

                {stats.languages && stats.languages.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="text-lg font-semibold text-zinc-900 mb-3">Languages & Technologies</h3>
                    <div className="flex flex-wrap gap-2">
                      {stats.languages.map((lang) => (
                        <span
                          key={lang}
                          className="px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full text-sm font-medium"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Score Breakdown (if available) */}
            {analysis && analysis.quantitative_score && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-zinc-900 mb-6">Score Breakdown</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-700">Quantitative Score</span>
                    <span className="text-xl font-bold text-zinc-900">{analysis.quantitative_score}/100</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-700">AI Enhanced Score</span>
                    <span className="text-xl font-bold text-zinc-900">{analysis.ai_enhanced_score}/100</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t">
                    <span className="text-zinc-900 font-semibold">Final Reputation Score</span>
                    <span className="text-2xl font-bold text-zinc-900">{analysis.score}/100</span>
                  </div>
                  <div className="text-xs text-zinc-500 text-center mt-2">
                    Formula: (Quantitative × 70%) + (AI Enhanced × 30%)
                  </div>
                </div>
              </div>
            )}

            {/* Last Updated */}
            {profile.last_analyzed_at && (
              <div className="text-center text-sm text-zinc-500">
                Last updated: {new Date(profile.last_analyzed_at).toLocaleDateString()} at{' '}
                {new Date(profile.last_analyzed_at).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colorClasses = {
    blue: 'from-blue-500 to-cyan-600',
    yellow: 'from-yellow-400 to-amber-500',
    purple: 'from-purple-500 to-indigo-600',
    green: 'from-green-500 to-emerald-600'
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 space-y-3">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center text-white`}>
        {icon}
      </div>
      <div>
        <div className="text-3xl font-bold text-zinc-900">{value.toLocaleString()}</div>
        <div className="text-sm text-zinc-500">{label}</div>
      </div>
    </div>
  );
}