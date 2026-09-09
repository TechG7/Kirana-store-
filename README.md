# जय माता किराना दी दुकान — Firebase Edition

## Firebase setup

1. Firebase Console में Authentication → Sign-in method → Email/Password enable करें।
2. Firestore Database create करें।
3. Storage enable करें।
4. इस project की `firebase/firestore.rules` को Firestore Rules में publish करें।
5. `firebase/storage.rules` को Storage Rules में publish करें।
6. Authentication → Users में अपना admin email/password user बनाएं।
7. Firestore में `admins` collection बनाएं।
8. Document ID = Authentication user का UID रखें।
9. उस document में:
   `role: "admin"`
10. GitHub Pages पर पूरा folder upload करें।

## Store settings

Admin → Settings में:
- Shop name
- WhatsApp number (91XXXXXXXXXX)
- UPI ID
- Google Maps link
- Address
- Opening/closing time
- Delivery fee
- Free delivery threshold
- Minimum order

## Important

UPI QR केवल payment intent बनाता है। इस frontend-only version में bank/payment success की automatic verification नहीं है। वास्तविक payment gateway verification के लिए trusted server/Cloud Functions + gateway integration चाहिए।

Never put a Firebase service-account JSON/private key in this GitHub Pages project.
