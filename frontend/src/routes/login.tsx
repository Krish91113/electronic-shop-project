import { createFileRoute } from '@tanstack/react-router';
import { Login } from '@/components/shop/public';
import { pageHead } from '@/components/shop/data';
export const Route = createFileRoute('/login')({head:()=>pageHead('Owner Login','Owner Login for the Volt electronics shop UI prototype. Sample data and local interactions only.'),component:Login});
