import { createFileRoute } from '@tanstack/react-router';
import { ProductDetail } from '@/components/shop/public';
import { pageHead } from '@/components/shop/data';
export const Route = createFileRoute('/products/$id')({head:()=>pageHead('Product Details','Product Details for the Volt electronics shop UI prototype. Sample data and local interactions only.'),component:ProductDetail});
