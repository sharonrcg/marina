/* eslint-disable @typescript-eslint/no-explicit-any */
import firebase_app from "../config";
import { DocumentReference, getFirestore } from "firebase/firestore";
import {
  collection,
  addDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  doc,
  getDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { Baby } from "../../pages/FamilyCreate";

const fs = getFirestore(firebase_app);

export const createBabies = async (familyId: string, babies: Baby[]) => {
  const babyRefs: DocumentReference[] = [];

  const batch = writeBatch(fs);

  babies.forEach((baby) => {
    const docRef = doc(collection(fs, "families", familyId, "babies"));
    babyRefs.push(docRef);
    batch.set(docRef, baby);
  });

  await batch.commit();
  return babyRefs;
};

export const createFamily = async (
  name,
  babies: Baby[],
  userId: string,
  email: string
) => {
  const familyDocRef = await addDoc(collection(fs, "families"), {
    name,
    adminId: userId,
    invitedUsers: [email], // might not need this
    parents: [userId],
  });
  await createBabies(familyDocRef.id, babies);
  return familyDocRef;
};

export const inviteUserToFamily = async (familyId: string, email: string) => {
  const familyDocRef = doc(fs, "families", familyId);

  // todo, only allow edit to invitedUsers field if userId is in parents field
  // prob firestore rule

  await updateDoc(familyDocRef, {
    invitedUsers: arrayUnion(email),
  });
};

export const acceptInviteToFamily = async (
  familyId: string,
  userId: string
) => {
  const familyDocRef = doc(fs, "families", familyId);

  // todo, only allow to edit parents field if email is in invitedUsers field
  // probably firestore rule?

  await updateDoc(familyDocRef, {
    parents: arrayUnion(userId),
  });
};

export const updateFamilyName = async (familyId: string, name: string) => {
  await updateDoc(doc(fs, "families", familyId), { name });
};

export const removeFamilyMember = async (familyId: string, userId: string) => {
  await updateDoc(doc(fs, "families", familyId), { parents: arrayRemove(userId) });
};

export const updateBaby = async (babyRef: DocumentReference, data: Partial<Baby>) => {
  await updateDoc(babyRef, data);
};

export const joinFamily = async (familyId: string, userId: string) => {
  const familyRef = doc(fs, "families", familyId);
  const snap = await getDoc(familyRef);
  if (!snap.exists()) throw new Error("Family not found. Check the code and try again.");
  await updateDoc(familyRef, { parents: arrayUnion(userId) });
  await setDoc(doc(fs, "users", userId), { family: familyRef }, { merge: true });
};
