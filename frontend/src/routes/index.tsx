import { createFileRoute } from '@tanstack/react-router';
import { Catalogue } from '@/components/shop/public';
import { pageHead } from '@/components/shop/data';
export const Route = createFileRoute('/')({head:()=>pageHead('Catalogue','Catalogue for the Volt electronics shop UI prototype. Sample data and local interactions only.'),component:Catalogue});
