import firebase_app from "../config";
import {
  DocumentReference,
  collection,
  getFirestore,
} from "firebase/firestore";
import { doc, setDoc, getDoc, getDocs } from "firebase/firestore";

const fs = getFirestore(firebase_app);

export const saveUserProfile = async (userId: string, profile: { name: string }) => {
  await setDoc(doc(fs, "users", userId), profile, { merge: true });
};

export const getUserProfile = async (userId: string): Promise<{ name?: string }> => {
  const snap = await getDoc(doc(fs, "users", userId));
  return { name: snap.data()?.name as string | undefined };
};

export const linkUserFamily = async (
  userId: string,
  familyRef: DocumentReference
) => {
  await setDoc(doc(fs, "users", userId), { family: familyRef }, { merge: true });
};

export const getLinkedFamily = async (userId: string) => {
  const userDocRef = await getDoc(doc(fs, "users", userId));
  const familyRef: DocumentReference | undefined = userDocRef.data()?.family;

  if (!familyRef) throw "No Linked Family";

  const familyDoc = await getDoc(familyRef);
  return { id: familyRef.id, name: familyDoc.data()?.name as string | undefined };
};

export const getBabies = async (userId) => {
  const userDocRef = await getDoc(doc(fs, "users", userId));
  const familyRef = userDocRef.data()?.family;

  if (!familyRef) throw "No Linked Family";

  const babiesQuerySnapshot = await getDocs(
    collection(fs, "families", familyRef.id, "babies")
  );
  return babiesQuerySnapshot.docs;
};
