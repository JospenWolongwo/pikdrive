'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { type PaymentProviderType } from '@/lib/payment/types';
import { Card } from '@/components/ui/card';

interface PaymentMethodSelectorProps {
  providers: Array<{
    name: PaymentProviderType
    logo: string
    displayName: string
    description: string
    processingTime: string
    minimumAmount: number
    maximumAmount: number
    processingFee: number
  }>
  selectedProvider?: PaymentProviderType
  onSelect: (provider: PaymentProviderType) => void
  disabled?: boolean
}

const providerImages: Record<PaymentProviderType, string> = {
  mtn: '/images/payment-providers/mtn.png',
  orange: '/images/payment-providers/orange.png'
}

export function PaymentMethodSelector({
  providers,
  selectedProvider,
  onSelect,
  disabled
}: PaymentMethodSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {providers.map((provider) => (
        <motion.div
          key={provider.name}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Card
            className={`p-4 cursor-pointer relative ${
              selectedProvider === provider.name
                ? 'border-primary ring-2 ring-primary ring-opacity-50'
                : 'hover:border-primary/50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={() => !disabled && onSelect(provider.name)}
          >
            {selectedProvider === provider.name && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            
            <div className="flex items-center space-x-4">
              <div className="relative w-32 h-24">
                <Image
                  src={providerImages[provider.name]}
                  alt={provider.name}
                  fill
                  className="object-fill"
                  priority
                />
              </div>
              
              <div className="flex-1">
                <h3 className="font-medium">{provider.displayName}</h3>
                <p className="text-sm text-muted-foreground">
                  {provider.description}
                </p>
                <div className="mt-1 text-xs text-muted-foreground">
                  Processing time: {provider.processingTime}
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Minimum amount:</span>
                <span>{provider.minimumAmount.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span>Maximum amount:</span>
                <span>{provider.maximumAmount.toLocaleString()} FCFA</span>
              </div>
              {provider.processingFee > 0 && (
                <div className="flex justify-between">
                  <span>Processing fee:</span>
                  <span>{provider.processingFee.toLocaleString()} FCFA</span>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
