import { useState } from 'react';
import { Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { usersService } from '@/services/users.service';
import type { PublicUser } from '@/types/users';

export interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: PublicUser;
  onSuccess: (updated: PublicUser) => void;
}

export function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  onSuccess,
}: UserProfileModalProps) {
  const [name, setName] = useState(currentUser.name || '');
  const [upiId, setUpiId] = useState(currentUser.upiId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUpi = upiId.trim();
    if (trimmedUpi && !/^[\w.-]+@[\w.-]+$/.test(trimmedUpi)) {
      setError('Please enter a valid UPI ID (e.g. name@upi or phone@paytm)');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await usersService.updateMe({
        name: name.trim() || currentUser.name,
        upiId: trimmedUpi || null,
      });
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Payment Settings & Profile"
      description="Configure your optional UPI ID so trip members can pay you directly."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Display Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
        />

        <div className="space-y-1.5">
          <Input
            label="UPI ID (Optional for receiving online payments)"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="e.g. yourname@upi, 9876543210@paytm"
            leftIcon={<Smartphone className="h-4 w-4 text-sand-500" />}
          />
          <p className="text-[11px] text-sand-500 leading-relaxed">
            Your UPI ID is only shown to members who owe you money when they select &ldquo;Pay online&rdquo;. TripNest never stores or requests bank passwords or UPI PINs.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-sand-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
          >
            {isSubmitting ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
