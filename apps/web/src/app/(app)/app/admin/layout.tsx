import { ToastProvider } from '../../../../components/ui/toast';
import { AdminHubLayout } from './admin-hub-layout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AdminHubLayout>{children}</AdminHubLayout>
    </ToastProvider>
  );
}
