import { createFileRoute } from '@tanstack/react-router';
import { ProductForm } from '@/components/shop/admin';
import { pageHead } from '@/components/shop/data';
export const Route = createFileRoute('/products/$id/edit')({head:()=>pageHead('Edit Product','Edit Product for the Volt electronics shop UI prototype. Sample data and local interactions only.'),component:ProductForm});
