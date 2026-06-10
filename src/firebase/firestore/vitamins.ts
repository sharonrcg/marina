import {
  DocumentReference,
  Timestamp,
  collection,
  limit,
  orderBy,
  query,
  addDoc,
  getDocs,
} from "firebase/firestore";

interface Vitamin {
  name: string;
  amount?: number;
  unit?: string;
  time: Timestamp;
}

export const addVitamin = async (babyRef: DocumentReference, vitamin: Vitamin) => {
  await addDoc(collection(babyRef, "vitamins"), vitamin);
};

export const getLatestVitamin = async (babyRef: DocumentReference) => {
  const q = query(collection(babyRef, "vitamins"), orderBy("time", "desc"), limit(1));
  return getDocs(q);
};

export const getVitamins = async (babyRef: DocumentReference, n = 20) => {
  const q = query(collection(babyRef, "vitamins"), orderBy("time", "desc"), limit(n));
  return getDocs(q);
};
