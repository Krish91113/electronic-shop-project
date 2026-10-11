import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { Products } from '@/components/shop/admin';
import { pageHead } from '@/components/shop/data';
export const Route = createFileRoute('/inventory')({head:()=>pageHead('Inventory','Inventory for the Volt electronics shop UI prototype. Sample data and local interactions only.'),component:Page});
function Page() {const pathname=useRouterState({select:s=>s.location.pathname}); return pathname.replace(/\/$/,'')==='/inventory' ? <Products inventory /> : <Outlet/>;}
