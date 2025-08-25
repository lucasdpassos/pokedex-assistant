'use client';

import { useState, useRef } from 'react';
import Chat from '@/components/Chat';
import Image from 'next/image';
import Link from 'next/link';
import { FileText } from 'lucide-react';

export default function Home() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e: React.MouseEvent) => {
    setShowTooltip(true);
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (showTooltip) {
      setMousePosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            AI Pokédex Assistant
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Your intelligent companion for all things Pokémon! Ask me about any Pokémon, analyze your team, or discover new favorites.
          </p>
        </div>
        
        {/* Main content area with background image and chat overlay */}
        <div className="relative min-h-[600px] flex items-center justify-center">
          {/* Background Character Image */}
          <div className="absolute inset-0 flex items-center justify-end pr-0 md:-mr-52 lg:-mr-52">
            <div className="relative">
              <Image
                src="/char.png"
                alt="Pokémon Character"
                width={600}
                height={600}
                className="object-contain"
                priority
              />
            </div>
          </div>
          
          {/* Chat Component - Overlay */}
          <div className="relative z-10 w-full max-w-5xl">
            <Chat />
          </div>
        </div>
        
        {/* Technical Writeup Button */}
        <div className="flex justify-center mt-8">
          <Link 
            href="/writeup"
            className="flex items-center gap-2 px-6 py-3 bg-[#872A31] text-white rounded-lg hover:bg-[#a5313a] transition-colors shadow-sm"
          >
            <FileText className="w-5 h-5" />
            <span className="font-medium">View Technical Writeup</span>
          </Link>
        </div>
        
        {/* Footer */}
        <footer className="mt-48 flex justify-end">
          <p className="text-md text-gray-400 dark:text-gray-500">
            Created by{' '}
            <a 
              href="https://www.linkedin.com/in/lucasdezerto/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#872A31] hover:text-[#6d2228] transition-colors underline decoration-1 underline-offset-2"
              onMouseEnter={handleMouseEnter}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              Lucas Passos
            </a>
          </p>
        </footer>
        
        {/* Animated Tooltip */}
        {showTooltip && (
          <div
            className="fixed pointer-events-none z-50 transition-all duration-200 ease-out"
            style={{
              left: mousePosition.x + 15,
              top: mousePosition.y - 60,
              transform: showTooltip ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(10px)',
              opacity: showTooltip ? 1 : 0,
            }}
          >
            <div className="relative">
              {/* Tooltip bubble */}
              <div className="bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg border border-stone-200 dark:border-gray-700 animate-bounce-gentle">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  <Image
                    src="/lucas.png"
                    alt="Lucas Passos"
                    width={48}
                    height={48}
                    className="object-cover w-full h-full"
                  />
                </div>
              </div>
              
              {/* Tooltip arrow */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="w-3 h-3 bg-white dark:bg-gray-800 border-r border-b border-stone-200 dark:border-gray-700 transform rotate-45"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}