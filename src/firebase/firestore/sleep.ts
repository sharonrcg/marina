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

interface SleepLog {
  start: Timestamp;
  end: Timestamp;
}

export const addSleep = async (babyRef: DocumentReference, sleep: SleepLog) => {
  await addDoc(collection(babyRef, "sleep"), sleep);
};

export const getLatestSleep = async (babyRef: DocumentReference) => {
  const q = query(collection(babyRef, "sleep"), orderBy("end", "desc"), limit(1));
  return getDocs(q);
};

export const getSleeps = async (babyRef: DocumentReference, n = 20) => {
  const q = query(collection(babyRef, "sleep"), orderBy("end", "desc"), limit(n));
  return getDocs(q);
};
