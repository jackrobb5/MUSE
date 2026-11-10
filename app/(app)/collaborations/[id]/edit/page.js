'use client';
import { useParams } from 'next/navigation';
import CollabForm from '@/components/CollabForm';
export default function EditCollab() {
  const { id } = useParams();
  return <main className="m-page"><h1>Edit listing</h1><CollabForm id={id} /></main>;
}
