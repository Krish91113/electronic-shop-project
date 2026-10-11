import { createContext, useContext, useState, type ReactNode } from 'react';
import headphones from '@/assets/headphones.jpg';
import speaker from '@/assets/speaker.jpg';
import keyboard from '@/assets/keyboard.jpg';
import charger from '@/assets/charger.jpg';
export type Product = { id: string; name: string; brand: string; model: string; category: string; price: number; cost: number; stock: number; threshold: number; barcode: string; image: string; description: string; warranty: string; active: boolean; visible: boolean };
// Deliberately small, fictional sample catalogue; no real stock or pricing records.
export const demoProducts: Product[] = [
 {id:'EL-001',name:'Studio Wireless Headphones',brand:'Soundcore',model:'Space One',category:'Audio',price:4999,cost:3600,stock:18,threshold:5,barcode:'890100000001',image:headphones,description:'Find your focus. Comfortable over-ear headphones with rich sound, wireless connectivity and active noise cancellation. A thoughtful companion for work, travel and everything in between.',warranty:'1 year limited warranty',active:true,visible:true},
 {id:'EL-002',name:'Portable Bluetooth Speaker',brand:'JBL',model:'Go Essential',category:'Audio',price:2499,cost:1800,stock:4,threshold:5,barcode:'890100000002',image:speaker,description:'Big sound, small footprint. A compact portable speaker with clear audio and a durable fabric finish for your everyday soundtrack.',warranty:'1 year limited warranty',active:true,visible:true},
 {id:'EL-003',name:'Wireless Mechanical Keyboard',brand:'Keychron',model:'K6',category:'Computer Peripherals',price:6499,cost:4800,stock:8,threshold:3,barcode:'890100000003',image:keyboard,description:'A satisfying, compact keyboard with tactile keys and wireless connectivity. Designed to make a little more room on your desk.',warranty:'1 year limited warranty',active:true,visible:true},
 {id:'EL-004',name:'Dual-Port USB-C Charger',brand:'Anker',model:'Nano 35W',category:'Chargers',price:899,cost:799,stock:0,threshold:5,barcode:'890100000004',image:charger,description:'Less waiting, more doing. A compact dual-port charger with a USB-C cable for convenient everyday charging.',warranty:'18 month limited warranty',active:true,visible:true},
];
export const money = (n: number) => '₹' + n.toLocaleString('en-IN', {maximumFractionDigits:2});
export const sales = [ {id:'INV-1024',date:'10 Oct 2026',items:2,total:7498,payment:'UPI',status:'Completed'}, {id:'INV-1023',date:'10 Oct 2026',items:1,total:6499,payment:'Card',status:'Completed'}, {id:'INV-1022',date:'09 Oct 2026',items:1,total:2499,payment:'Cash',status:'Completed'} ];
type Store = {products:Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; shop:string; setShop:(s:string)=>void};
const Context = createContext<Store | null>(null);
export function DemoProvider({children}:{children:ReactNode}) { const [products,setProducts]=useState(demoProducts); const [shop,setShop]=useState('Shop A'); return <Context.Provider value={{products,setProducts,shop,setShop}}>{children}</Context.Provider> }
export function useDemo(){const value=useContext(Context); if(!value) throw new Error('DemoProvider required'); return value}
export const pageHead = (title:string, description:string) => ({meta:[{title:`${title} · Volt Electronics`},{name:'description',content:description},{property:'og:title',content:`${title} · Volt Electronics`},{property:'og:description',content:description},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]});
