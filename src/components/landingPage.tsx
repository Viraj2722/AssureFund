import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import React from "react"
import WalletConnect from "./walletConnect"

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-white relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute left-1/2 top-0 -ml-20 h-[40rem] w-[40rem] rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 opacity-20 blur-3xl"></div>
                <div className="absolute right-1/4 top-1/4 h-[30rem] w-[30rem] rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 opacity-20 blur-3xl"></div>
            </div>

            <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
                <div className="max-w-4xl w-full text-center space-y-16">
                    {/* Logo */}
                    <div>
                        <div className="inline-flex items-center justify-center space-x-4">
                            <img
                                src="/Brand-Light.png"
                                alt="Assure Fund Logo"
                                className="w-30 h-20 lg:w-50 lg:h-50 object-contain"
                            />
                            <img
                                src="/Text-Light.png"
                                alt="Assure Fund"
                                className="h-10 lg:h-15 object-contain"
                            />
                        </div>
                    </div>

                    {/* Hero Text */}
                    <div className="space-y-10">
                        <div className="space-y-8">
                            <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold text-zinc-900 leading-[0.9] tracking-tighter">
                                Where <span className="text-zinc-600">developers</span>
                                <span className="block text-zinc-800">get backed</span>
                            </h1>
                        </div>

                        <div className="max-w-md mx-auto">
                            <p className="text-lg md:text-xl text-zinc-500 font-light leading-relaxed">
                                Community-verified funding for{" "}
                                <span className="font-medium text-zinc-700">developers</span>{" "}
                                building the future
                            </p>
                        </div>
                    </div>

                    {/* CTA */}
                    <div>
                        <div className="inline-block group">
                            <div>
                                <WalletConnect />
                            </div>
                        </div>
                        
                        {/* Info text */}
                        <p className="text-sm text-zinc-500 mt-6">
                            Connect your wallet to get started • Link GitHub to build reputation
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}