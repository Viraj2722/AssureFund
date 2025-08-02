// components/LandingPage.jsx
"use client";

import { useState } from "react";

export default function LandingPage() {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    // Simulate wallet connection
    setTimeout(() => {
      setIsConnecting(false);
      alert("Wallet connection would be implemented here");
    }, 2000);
  };

  const platformFeatures = [
    {
      title: "Secure Escrow System",
      description:
        "Smart contract-based escrow ensuring safe transactions between all parties",
    },
    {
      title: "Decentralized Crowdfunding",
      description:
        "Transparent blockchain-powered funding with community governance",
    },
    {
      title: "Global Payment Network",
      description:
        "Instant cross-border payments with multiple cryptocurrency support",
    },
    {
      title: "Reputation & Trust",
      description:
        "Immutable reputation scores based on completed projects and feedback",
    },
    {
      title: "Milestone Management",
      description: "Project milestone tracking with automated payment releases",
    },
  ];

  return (
    <>
      {/* Import Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className="min-h-screen bg-black text-white"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {/* Main Container with equal padding on all sides */}
        <div className="h-screen flex items-center justify-center p-12">
          <div className="w-full max-w-7xl mx-auto">
            {/* Main Grid Layout */}
            <div className="grid lg:grid-cols-2 gap-20 items-center h-full">
              {/* Left Side - Cards Grid with Staggered Layout */}
              <div className="flex items-center justify-center">
                <div className="relative w-full max-w-2xl">
                  {/* First Row */}
                  <div className="flex gap-6 mb-6">
                    <div className="flex-1 bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-sm hover:border-gray-600/70 hover:shadow-xl hover:shadow-white/5 transition-all duration-300">
                      <h3
                        className="text-lg font-semibold mb-3 text-white leading-tight"
                        style={{ fontFamily: "Space Grotesk, sans-serif" }}
                      >
                        {platformFeatures[0].title}
                      </h3>
                      <p className="text-gray-400 text-sm leading-relaxed font-light">
                        {platformFeatures[0].description}
                      </p>
                    </div>

                    <div className="flex-1 bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-sm hover:border-gray-600/70 hover:shadow-xl hover:shadow-white/5 transition-all duration-300 mt-8">
                      <h3
                        className="text-lg font-semibold mb-3 text-white leading-tight"
                        style={{ fontFamily: "Space Grotesk, sans-serif" }}
                      >
                        {platformFeatures[1].title}
                      </h3>
                      <p className="text-gray-400 text-sm leading-relaxed font-light">
                        {platformFeatures[1].description}
                      </p>
                    </div>
                  </div>

                  {/* Second Row */}
                  <div className="flex gap-6 mb-6">
                    <div className="flex-1 bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-sm hover:border-gray-600/70 hover:shadow-xl hover:shadow-white/5 transition-all duration-300">
                      <h3
                        className="text-lg font-semibold mb-3 text-white leading-tight"
                        style={{ fontFamily: "Space Grotesk, sans-serif" }}
                      >
                        {platformFeatures[2].title}
                      </h3>
                      <p className="text-gray-400 text-sm leading-relaxed font-light">
                        {platformFeatures[2].description}
                      </p>
                    </div>

                    <div className="flex-1 bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-sm hover:border-gray-600/70 hover:shadow-xl hover:shadow-white/5 transition-all duration-300 mt-8">
                      <h3
                        className="text-lg font-semibold mb-3 text-white leading-tight"
                        style={{ fontFamily: "Space Grotesk, sans-serif" }}
                      >
                        {platformFeatures[3].title}
                      </h3>
                      <p className="text-gray-400 text-sm leading-relaxed font-light">
                        {platformFeatures[3].description}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Full Width Card */}
                  <div className="w-full bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-sm hover:border-gray-600/70 hover:shadow-xl hover:shadow-white/5 transition-all duration-300">
                    <h3
                      className="text-lg font-semibold mb-3 text-white leading-tight"
                      style={{ fontFamily: "Space Grotesk, sans-serif" }}
                    >
                      {platformFeatures[4].title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed font-light">
                      {platformFeatures[4].description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Side - Title & Connect Button */}
              <div className="flex flex-col items-center justify-center text-center space-y-10">
                {/* Title Section */}
                <div className="space-y-6">
                  <h1
                    className="text-6xl lg:text-8xl font-black tracking-tight leading-none"
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  >
                    <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                      AssureFund
                    </span>
                  </h1>
                  <p className="text-xl text-gray-300 max-w-md mx-auto leading-relaxed font-light tracking-wide">
                    a secure crowdfunding and freelancing platform
                  </p>
                </div>

                {/* Connect Wallet Button */}
                <div className="pt-6">
                  <button
                    onClick={handleConnectWallet}
                    disabled={isConnecting}
                    className="
                      group relative px-12 py-4 
                      bg-white text-black font-medium text-lg
                      rounded-full border-2 border-white
                      hover:bg-gray-50 hover:shadow-2xl hover:shadow-white/25
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-300 ease-out
                      min-w-[240px] tracking-wide
                    "
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  >
                    <span className="relative z-10">
                      {isConnecting ? (
                        <div className="flex items-center justify-center space-x-3">
                          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                          <span>connecting...</span>
                        </div>
                      ) : (
                        "connect wallet"
                      )}
                    </span>

                    {/* Button glow effect */}
                    <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-30 transition-opacity duration-300 blur-xl scale-110"></div>
                  </button>

                  {/* Status indicators */}
                  <div className="mt-10 space-y-4">
                    <div className="flex items-center justify-center space-x-3 text-gray-400 text-sm font-light">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                      <span className="tracking-wide">
                        secure & decentralized
                      </span>
                    </div>
                    <div className="flex items-center justify-center space-x-3 text-gray-400 text-sm font-light">
                      <div
                        className="w-2 h-2 bg-blue-400 rounded-full animate-pulse shadow-lg shadow-blue-400/50"
                        style={{ animationDelay: "0.7s" }}
                      ></div>
                      <span className="tracking-wide">multi-chain support</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
