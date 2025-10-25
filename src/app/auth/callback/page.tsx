// app/auth/callback/page.tsx (Next.js 13+ App Router)
// OR pages/auth/callback.tsx (Pages Router)

'use client' // Remove if using Pages Router

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation' // Use 'next/router' for Pages Router
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Loader2 } from 'lucide-react'

export default function AuthCallback() {
    const router = useRouter()
    const supabase = createClientComponentClient()
    const [status, setStatus] = useState('Connecting your GitHub account...')
    const [error, setError] = useState('')

    useEffect(() => {
        handleCallback()
    }, [])

    const handleCallback = async () => {
        try {
            // Get the session from Supabase
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            
            if (sessionError) throw sessionError
            if (!session) throw new Error('No session found')

            // Get wallet address from localStorage
            const walletAddress = localStorage.getItem('pending_wallet_address')
            if (!walletAddress) {
                throw new Error('No wallet address found. Please connect wallet first.')
            }

            setStatus('Creating your profile...')

            // Get GitHub user info from session
            const githubUser = session.user.user_metadata
            const accessToken = session.provider_token

            // Create or update profile in Supabase
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    wallet_address: walletAddress,
                    github_id: githubUser.user_name || githubUser.preferred_username,
                    github_username: githubUser.user_name || githubUser.preferred_username,
                    github_avatar_url: githubUser.avatar_url,
                    github_access_token: accessToken,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'wallet_address'
                })
                .select()
                .single()

            if (profileError) throw profileError

            setStatus('Analyzing your GitHub profile...')

            // Trigger reputation analysis
            await fetch('/api/reputation/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    wallet_address: walletAddress,
                    github_token: accessToken
                })
            })

            // Clear pending wallet address
            localStorage.removeItem('pending_wallet_address')

            setStatus('Success! Redirecting...')

            // Redirect to homepage after 1 second
            setTimeout(() => {
                router.push('/home?github_connected=true')
            }, 1000)

        } catch (error: any) {
            console.error('Callback error:', error)
            setError(error.message || 'Failed to connect GitHub')
            
            // Redirect back to landing page after 3 seconds
            setTimeout(() => {
                router.push('/?error=github_connection_failed')
            }, 3000)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100">
            <div className="max-w-md w-full mx-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
                    {error ? (
                        <>
                            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900">Connection Failed</h2>
                                <p className="text-sm text-zinc-600 mt-2">{error}</p>
                                <p className="text-xs text-zinc-500 mt-4">Redirecting back...</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 mx-auto">
                                <Loader2 className="w-16 h-16 text-zinc-900 animate-spin" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900">{status}</h2>
                                <p className="text-sm text-zinc-600 mt-2">Please wait while we set up your profile</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}