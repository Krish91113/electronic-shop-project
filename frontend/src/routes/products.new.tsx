import { createFileRoute } from '@tanstack/react-router';
import { ProductForm } from '@/components/shop/admin';
import { pageHead } from '@/components/shop/data';
export const Route = createFileRoute('/products/new')({head:()=>pageHead('Add Product','Add Product for the Volt electronics shop UI prototype. Sample data and local interactions only.'),component:ProductForm});
