import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/shop/admin';
import { pageHead } from '@/components/shop/data';
export const Route = createFileRoute('/dashboard')({head:()=>pageHead('Dashboard','Dashboard for the Volt electronics shop UI prototype. Sample data and local interactions only.'),component:Dashboard});
