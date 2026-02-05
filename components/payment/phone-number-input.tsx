'use client';

import { useState, useEffect } from 'react';
import { Phone } from 'lucide-react';
import { Input, Label } from '@/components/ui';
import { isMTNPhoneNumber, isOrangePhoneNumber } from '@/lib/payment/phone-utils';
import { useLocale } from '@/hooks';

interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidityChange: (isValid: boolean) => void;
  provider?: 'mtn' | 'orange';
  disabled?: boolean;
}

export function PhoneNumberInput({
  value,
  onChange,
  onValidityChange,
  provider,
  disabled
}: PhoneNumberInputProps) {
  const { t } = useLocale();
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validatePhoneNumber = (number: string) => {
    // Remove spaces and any other non-digit characters except +
    const cleaned = number.replace(/[^\d+]/g, '');
    
    // Basic validation for Cameroon phone numbers
    const phoneRegex = /^(?:\+237|237)?[6-9][0-9]{8}$/;
    const isValidFormat = phoneRegex.test(cleaned);

    // Extract the actual number without country code for validation
    const actualNumber = cleaned.replace(/^(?:\+237|237)?/, '');

    // Provider-specific validation using utility functions
    let isValidProvider = true;
    let providerError: string | null = null;
    
    if (provider) {
      if (provider === 'mtn') {
        if (!isMTNPhoneNumber(actualNumber)) {
          providerError = t("phone.errors.invalidMTN");
          isValidProvider = false;
        }
      } else if (provider === 'orange') {
        if (!isOrangePhoneNumber(actualNumber)) {
          providerError = t("phone.errors.invalidOrange");
          isValidProvider = false;
        }
      }
    }

    const isValidNumber = isValidFormat && isValidProvider;
    
    // Set error message
    if (providerError) {
      setError(providerError);
    } else if (!isValidNumber && isValidFormat) {
      setError(t("phone.errors.invalidCameroon"));
    } else if (isValidNumber) {
      setError(null);
    } else {
      setError(t("phone.errors.invalidCameroon"));
    }

    setIsValid(isValidNumber);
    onValidityChange(isValidNumber);

    return isValidNumber;
  };

  useEffect(() => {
    validatePhoneNumber(value);
  }, [value, provider]);

  const formatPhoneNumber = (number: string) => {
    // Remove all non-digit characters except +
    let cleaned = number.replace(/[^\d+]/g, '');
    
    // Ensure the number starts with +237 if it doesn't already
    if (!cleaned.startsWith('+') && !cleaned.startsWith('237')) {
      cleaned = '+237' + cleaned;
    } else if (cleaned.startsWith('237')) {
      cleaned = '+' + cleaned;
    }

    // Format the number: +237 X XX XX XX XX
    if (cleaned.length > 4) {
      const parts = [
        cleaned.slice(0, 4), // +237
        cleaned.slice(4, 5), // X
        cleaned.slice(5, 7), // XX
        cleaned.slice(7, 9), // XX
        cleaned.slice(9, 11), // XX
        cleaned.slice(11, 13), // XX
      ].filter(Boolean);
      
      cleaned = parts.join(' ');
    }

    return cleaned;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const formatted = formatPhoneNumber(e.target.value);
    onChange(formatted);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="phone-number">{t("phone.label")}</Label>
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="phone-number"
          type="tel"
          placeholder={t("phone.placeholder")}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={`pl-10 ${disabled ? 'opacity-50 cursor-not-allowed' : isValid ? 'border-green-500' : error ? 'border-red-500' : ''}`}
        />
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      {isValid && (
        <p className="text-sm text-green-500">{t("phone.validNumber")}</p>
      )}
    </div>
  );
}
