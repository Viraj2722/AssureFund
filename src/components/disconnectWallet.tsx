"use client";

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from './ui/button';
import { LogOut } from 'lucide-react';

interface DisconnectWalletButtonProps {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    className?: string;
    children?: React.ReactNode;
    showAddress?: boolean;
}

const DisconnectWalletButton: React.FC<DisconnectWalletButtonProps> = ({
    variant = 'outline',
    size = 'default',
    className,
    children,
    showAddress = false
}) => {
    const { disconnect, connected, publicKey, wallet } = useWallet();

    if (!connected) return null;

    const handleDisconnect = () => {
        disconnect();
    };

    const formatAddress = (address: string) => {
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };

    return (
        <Button
            variant={variant}
            size={size}
            className={className}
            onClick={handleDisconnect}
        >
            {children || (
                <>
                    {wallet && (
                        <img
                            src={wallet.adapter.icon}
                            alt={wallet.adapter.name}
                            className="w-4 h-4 mr-2"
                        />
                    )}
                    {showAddress && publicKey && (
                        <span className="mr-2 font-mono text-sm">
                            {formatAddress(publicKey.toString())}
                        </span>
                    )}
                    <LogOut className="w-4 h-4" />
                    {!showAddress && <span className="ml-2">Disconnect</span>}
                </>
            )}
        </Button>
    );
};

export default DisconnectWalletButton;