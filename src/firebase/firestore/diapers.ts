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

interface Diaper {
  type: string;
  time: Timestamp;
}

export const addDiaper = async (babyRef: DocumentReference, diaper: Diaper) => {
  await addDoc(collection(babyRef, "diapers"), diaper);
};

export const getLatestDiaper = async (babyRef: DocumentReference) => {
  const q = query(collection(babyRef, "diapers"), orderBy("time", "desc"), limit(1));
  return getDocs(q);
};

export const getDiapers = async (babyRef: DocumentReference, n = 20) => {
  const q = query(collection(babyRef, "diapers"), orderBy("time", "desc"), limit(n));
  return getDocs(q);
};
