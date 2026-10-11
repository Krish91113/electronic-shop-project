import { createFileRoute } from '@tanstack/react-router';
import { ReceiveStock } from '@/components/shop/admin';
import { pageHead } from '@/components/shop/data';
export const Route = createFileRoute('/inventory/receive')({head:()=>pageHead('Receive Stock','Receive Stock for the Volt electronics shop UI prototype. Sample data and local interactions only.'),component:ReceiveStock});
