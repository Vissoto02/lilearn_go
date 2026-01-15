import { toast } from 'sonner';

interface ToastOptions {
    title: string;
    description?: string;
    variant?: 'default' | 'destructive';
}

export function useToast() {
    return {
        toast: ({ title, description, variant }: ToastOptions) => {
            if (variant === 'destructive') {
                toast.error(title, { description });
            } else {
                toast.success(title, { description });
            }
        },
        dismiss: toast.dismiss,
    };
}

export { toast };
