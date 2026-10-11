import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { Sales } from '@/components/shop/admin';
import { pageHead } from '@/components/shop/data';
export const Route = createFileRoute('/sales')({head:()=>pageHead('Sales History','Sales History for the Volt electronics shop UI prototype. Sample data and local interactions only.'),component:Page});
function Page() {const pathname=useRouterState({select:s=>s.location.pathname}); return pathname.replace(/\/$/,'')==='/sales' ? <Sales /> : <Outlet/>;}
