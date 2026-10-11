import { createFileRoute } from '@tanstack/react-router';
import { Reports } from '@/components/shop/admin';
import { pageHead } from '@/components/shop/data';
export const Route = createFileRoute('/reports/profit-loss')({head:()=>pageHead('Profit and Loss','Profit and Loss for the Volt electronics shop UI prototype. Sample data and local interactions only.'),component:Reports});
