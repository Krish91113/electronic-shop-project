import { createFileRoute } from '@tanstack/react-router';
import { Invoice } from '@/components/shop/admin';
import { pageHead } from '@/components/shop/data';
export const Route = createFileRoute('/sales/$id')({head:()=>pageHead('Invoice Preview','Invoice Preview for the Volt electronics shop UI prototype. Sample data and local interactions only.'),component:Invoice});
