import { createFileRoute } from '@tanstack/react-router';
import { Settings } from '@/components/shop/admin';
import { pageHead } from '@/components/shop/data';
export const Route = createFileRoute('/settings')({head:()=>pageHead('Shop Settings','Shop Settings for the Volt electronics shop UI prototype. Sample data and local interactions only.'),component:Settings});
