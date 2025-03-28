'use client';

import { useState, useEffect } from 'react';
import { Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validatePhoneNumber = (number: string) => {
    // Remove spaces and any other non-digit characters except +
    const cleaned = number.replace(/[^\d+]/g, '');
    
    // Basic validation for Cameroon phone numbers
    const phoneRegex = /^(?:\+237|237)?[6-9][0-9]{8}$/;
    const isValidFormat = phoneRegex.test(cleaned);

    // Extract the actual number without country code
    const actualNumber = cleaned.replace(/^(?:\+237|237)?/, '');

    // Provider-specific validation
    let isValidProvider = true;
    if (provider) {
      const prefix = actualNumber.slice(0, 2);
      if (provider === 'mtn' && prefix !== '67') {
        setError('Please enter a valid MTN number (starting with 67)');
        isValidProvider = false;
      } else if (provider === 'orange' && prefix !== '69') {
        setError('Please enter a valid Orange number (starting with 69)');
        isValidProvider = false;
      }
    }

    const isValidNumber = isValidFormat && isValidProvider;
    setIsValid(isValidNumber);
    onValidityChange(isValidNumber);

    if (!isValidNumber && !error) {
      setError('Please enter a valid Cameroon phone number');
    } else if (isValidNumber) {
      setError(null);
    }

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
      <Label htmlFor="phone-number">Phone Number</Label>
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="phone-number"
          type="tel"
          placeholder="+237 6 XX XX XX XX"
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
        <p className="text-sm text-green-500">Valid phone number</p>
      )}
    </div>
  );
}
