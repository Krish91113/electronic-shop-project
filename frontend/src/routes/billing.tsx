import { createFileRoute } from '@tanstack/react-router';
import { Billing } from '@/components/shop/billing';
import { pageHead } from '@/components/shop/data';
export const Route = createFileRoute('/billing')({head:()=>pageHead('New Bill','New Bill for the Volt electronics shop UI prototype. Sample data and local interactions only.'),component:Billing});
