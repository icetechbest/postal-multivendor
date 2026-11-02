// Components
import NodeMailerAddForm from '../../add-form/nodemailer';
import DeliveryRateAddForm from '../../add-form/delivery-rate';
import TwilioAddForm from '../../add-form/twilio';
import SentryAddForm from '../../add-form/sentry-config';
import GoogleApiAddForm from '../../add-form/google-api';
import CloudinaryAddForm from '../../add-form/cloudinary';
import AmplitudeAddForm from '../../add-form/amplitude';
import GoogleClientAddForm from '../../add-form/google-client';
import FirebaseAdminAddForm from '../../add-form/firebase-admin';
import AppConfigAddForm from '../../add-form/app-config';
import VerificationAddForm from '../../add-form/verification';
import CurrencyAddForm from '../../add-form/currency';
import AppVersionAddForm from '../../add-form/app-versions';

const ConfigMain = () => {
  return (
    <div className="space-y-6 flex  flex-col  p-3">
      <NodeMailerAddForm />
      <CurrencyAddForm />
      <DeliveryRateAddForm />
      <TwilioAddForm />
      <SentryAddForm />
      <GoogleApiAddForm />
      <CloudinaryAddForm />
      <AmplitudeAddForm />
      <GoogleClientAddForm />
      <FirebaseAdminAddForm />
      <AppConfigAddForm />
      <VerificationAddForm />
      <AppVersionAddForm />
    </div>
  );
};

export default ConfigMain;
