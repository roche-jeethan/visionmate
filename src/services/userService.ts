// services/userService.ts

import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, updateDoc, doc  } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import app  from '../../firebase/config';

const db = getFirestore(app);

export const addEmergencyContact = async (number: string) => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  await addDoc(collection(db, 'contacts'), {
    uid: user.uid,
    number
  });
};

export const getEmergencyContacts = async (): Promise<string[]> => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const q = query(collection(db, 'contacts'), where('uid', '==', user.uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data().number);
};

export const getDefaultContact = async (): Promise<string> => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const q = query(
    collection(db, 'contacts'),
    where('uid', '==', user.uid),
    where('defaultContact', '!=', null)
  );

  const snapshot = await getDocs(q);

  // Default contact already exists
  if (!snapshot.empty) {
    const contactDoc = snapshot.docs[0];
    const number = contactDoc.data()?.number;
    if (!number) throw new Error("Number field is missing in contact");
    return number;
  }

  // No default contact — create one
  const allContacts = await getDocs(
    query(collection(db, 'contacts'), where('uid', '==', user.uid))
  );

  if (allContacts.empty) {
    throw new Error("No contacts found for this user");
  }

  const firstContact = allContacts.docs[0];
  const number = firstContact.data()?.number;

  if (!number) throw new Error("Number field is missing in contact");

  // Update Firestore to set this contact as default
  await updateDoc(doc(db, "contacts", firstContact.id), {
    defaultContact: number
  });

  console.log("Default contact set to:", number);
  return number;
};


export const saveDefaultContact = async (formattedNumber: string) => {
  try {
    const db = getFirestore();
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) throw new Error("User not authenticated");

    const q = query(
      collection(db, "contacts"),
      where("uid", "==", currentUser.uid),
      where("number", "==", formattedNumber) // Use formattedNumber here
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const contactDoc = snapshot.docs[0];
      await updateDoc(doc(db, "contacts", contactDoc.id), {
        defaultContact: formattedNumber // Use formattedNumber here
      });
      console.log("Default contact field added to contact!");
    } else {
      console.warn("No contact found to mark as default.");
    }
  } catch (error) {
    console.error("Error saving default contact: ", error);
  } 
}

export const deleteEmergencyContact = async (contact: string) => {
  const user = getAuth().currentUser;
  if (!user) throw new Error("User not authenticated");

  const q = query(
    collection(db, 'contacts'),
    where('uid', '==', user.uid),
    where('number', '==', contact)
  );

  const snapshot = await getDocs(q);

  const deletePromises = snapshot.docs.map(docSnap =>
    deleteDoc(docSnap.ref) 
  );

  await Promise.all(deletePromises);
};