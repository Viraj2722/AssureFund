import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useWallet } from "@solana/wallet-adapter-react"
import { useState, useEffect } from "react"
import { Wallet, AlertCircle, ChevronRight, Github } from "lucide-react"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

export default function WalletConnect() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [showGithubConnect, setShowGithubConnect] = useState(false)
    const [isLoadingProfile, setIsLoadingProfile] = useState(false)
    const router = useRouter()
    const supabase = createClientComponentClient()
    
    const {
        wallet,
        connect,
        disconnect,
        connecting,
        disconnecting,
        connected,
        wallets,
        select,
        publicKey,
    } = useWallet()

    // Check if user already has GitHub connected
    useEffect(() => {
        if (connected && publicKey) {
            checkGithubConnection()
        }
    }, [connected, publicKey])

    const checkGithubConnection = async () => {
        if (!publicKey) return

        setIsLoadingProfile(true)
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('github_username')
                .eq('wallet_address', publicKey.toString())
                .single()

            if (error || !profile) {
                // No profile exists, show GitHub connect prompt
                console.log('No profile found, showing GitHub connect')
                setShowGithubConnect(true)
            } else if (!profile.github_username) {
                // Profile exists but no GitHub, show connect prompt
                console.log('Profile exists but no GitHub, showing connect')
                setShowGithubConnect(true)
            } else {
                // Already connected, redirect to homepage
                console.log('GitHub already connected, redirecting to home')
                router.push('/home')
            }
        } catch (error) {
            console.error('Error checking profile:', error)
            // On error, show GitHub connect as fallback
            setShowGithubConnect(true)
        } finally {
            setIsLoadingProfile(false)
        }
    }

    const handleGithubConnect = async () => {
        if (!publicKey) return

        try {
            // Store wallet address in localStorage to link after GitHub OAuth
            localStorage.setItem('pending_wallet_address', publicKey.toString())

            // Initiate GitHub OAuth through Supabase
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    scopes: 'read:user repo'
                }
            })

            if (error) throw error
        } catch (error) {
            console.error('Failed to connect GitHub:', error)
        }
    }

    const label = connected
        ? ""
        : connecting
            ? "Connecting..."
            : disconnecting
                ? "Disconnecting..."
                : wallet
                    ? "Connect"
                    : "Select Wallet"

    const formatPublicKey = (publicKey: string) => {
        if (!publicKey) return ""
        return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`
    }

    const handleMainButtonClick = async () => {
        if (!connected) {
            if (wallet) {
                try {
                    await connect()
                } catch (error) {
                    console.error("Failed to connect:", error)
                }
            } else {
                setIsModalOpen(true)
            }
        }
    }

    const handleWalletSelect = async (walletName: string) => {
        try {
            select(walletName)
            setIsModalOpen(false)
        } catch (error) {
            console.error("Failed to select wallet:", error)
        }
    }

    const availableWallets = wallets.filter(
        (wallet) => wallet.readyState === "Installed"
    )

    return (
        <>
            <div className="flex items-center">
                <Button
                    onClick={handleMainButtonClick}
                    size="lg"
                    disabled={connecting || disconnecting || isLoadingProfile}
                    className="flex items-center gap-2 px-8 py-4 rounded-xl font-medium text-base md:text-lg bg-zinc-900 text-white shadow-md hover:bg-zinc-800 active:scale-[0.98] transition-all"
                >
                    <Wallet className="h-5 w-5" />
                    {isLoadingProfile 
                        ? "Loading..." 
                        : connected
                            ? formatPublicKey(publicKey?.toString() || "")
                            : label
                    }
                </Button>
            </div>

            {/* Wallet Selection Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="rounded-2xl max-w-[400px] p-0 overflow-hidden shadow-2xl">
                    <DialogHeader className="border-b p-6 text-left">
                        <DialogTitle className="text-xl font-semibold">
                            Connect Wallet
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Choose your preferred wallet provider
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-4">
                        {availableWallets.length > 0 ? (
                            <div className="space-y-3">
                                {availableWallets.map((wallet) => (
                                    <button
                                        key={wallet.adapter.name}
                                        className="flex w-full items-center justify-between p-4 rounded-xl border border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:bg-zinc-100 transition-all shadow-sm"
                                        onClick={() => handleWalletSelect(wallet.adapter.name)}
                                    >
                                        <div className="flex items-center gap-3">
                                            {wallet.adapter.icon && (
                                                <img
                                                    src={wallet.adapter.icon}
                                                    alt={wallet.adapter.name}
                                                    className="w-8 h-8 rounded-full"
                                                />
                                            )}
                                            <span className="font-medium text-sm">
                                                {wallet.adapter.name}
                                            </span>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center p-8 text-center space-y-4 bg-zinc-50 rounded-xl border border-zinc-200">
                                <AlertCircle className="h-10 w-10 text-yellow-500" />
                                <div className="space-y-1">
                                    <p className="font-medium">No wallets detected</p>
                                    <p className="text-sm text-muted-foreground">
                                        Install a Solana wallet extension to continue
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* GitHub Connect Modal */}
            <Dialog open={showGithubConnect} onOpenChange={setShowGithubConnect}>
                <DialogContent className="rounded-2xl max-w-[500px] p-0 overflow-hidden shadow-2xl">
                    <DialogHeader className="border-b p-6 text-left">
                        <DialogTitle className="text-xl font-semibold">
                            Connect Your GitHub
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Build trust with your reputation score
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-1 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-medium text-sm">Verify Your Identity</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Your GitHub activity proves you're a real developer
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="mt-1 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-medium text-sm">Build Your Reputation</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Get a score based on your contributions, projects, and activity
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="mt-1 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-medium text-sm">Gain Trust from Backers</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Higher reputation means more confidence from funders
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t space-y-3">
                            <Button
                                onClick={handleGithubConnect}
                                className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white"
                                size="lg"
                            >
                                <Github className="h-5 w-5" />
                                Connect with GitHub
                            </Button>
                            
                            <Button
                                onClick={() => {
                                    setShowGithubConnect(false)
                                    router.push('/home')
                                }}
                                variant="ghost"
                                className="w-full"
                            >
                                Skip for now
                            </Button>
                        </div>

                        <p className="text-xs text-center text-muted-foreground">
                            We only access public information. You can disconnect anytime.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}