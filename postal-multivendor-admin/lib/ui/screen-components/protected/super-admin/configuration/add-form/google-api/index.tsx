'use client';
// Core
import { Form, Formik } from 'formik';

// Components
import ConfigCard from '../../view/card';
import CustomTextField from '@/lib/ui/useable-components/input-field';

// Toast
import useToast from '@/lib/hooks/useToast';

// Hooks
import { useConfiguration } from '@/lib/hooks/useConfiguration';

// Interfaces and Types
import { IGoogleApiForm } from '@/lib/utils/interfaces/configurations.interface';

// Utils and Constants
import { GoogleApiValidationSchema } from '@/lib/utils/schema';

// GraphQL
import {
  GET_CONFIGURATION,
  SAVE_GOOGLE_API_KEY_CONFIGURATION,
} from '@/lib/api/graphql';
import { useMutation } from '@apollo/client';

const GoogleApiAddForm = () => {
  // Hooks
  const { MAP_TILE_URL, GEOCODING_URL, ROUTING_URL } = useConfiguration();
  const { showToast } = useToast();

  // Initial values for the form
  const initialValues = {
    mapTileUrl: MAP_TILE_URL ?? '',
    geocodingUrl: GEOCODING_URL ?? '',
    routingUrl: ROUTING_URL ?? '',
  };

  const [mutate, { loading: mutationLoading }] = useMutation(
    SAVE_GOOGLE_API_KEY_CONFIGURATION,
    {
      refetchQueries: [{ query: GET_CONFIGURATION }],
    }
  );

  const handleSubmit = (values: IGoogleApiForm) => {
    mutate({
      variables: {
        configurationInput: {
          mapTileUrl: values.mapTileUrl,
          geocodingUrl: values.geocodingUrl,
          routingUrl: values.routingUrl,
        },
      },
      onCompleted: () => {
        showToast({
          type: 'success',
          title: 'Success!',
          message: 'Map Service URLs Updated',
          duration: 3000,
        });
      },
      onError: (error) => {
        let message = '';
        try {
          message = error.graphQLErrors[0]?.message;
        } catch {
          message = 'ActionFailedTryAgain';
        }
        showToast({
          type: 'error',
          title: 'Error!',
          message,
          duration: 3000,
        });
      },
    });
  };

  return (
    <div>
      <Formik
        initialValues={initialValues}
        validationSchema={GoogleApiValidationSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {({ values, errors, touched, handleSubmit, handleChange }) => {
          return (
            <Form onSubmit={handleSubmit}>
              <ConfigCard
                cardTitle={'Map Services (OpenStreetMap)'}
                buttonLoading={mutationLoading}
              >
                <div className="grid grid-cols-1 gap-4">
                  <CustomTextField
                    type="text"
                    placeholder="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    name="mapTileUrl"
                    maxLength={255}
                    value={values.mapTileUrl}
                    showLabel={true}
                    onChange={handleChange}
                    style={{
                      borderColor:
                        errors.mapTileUrl && touched.mapTileUrl ? 'red' : '',
                    }}
                  />
                  <CustomTextField
                    type="text"
                    placeholder="https://nominatim.openstreetmap.org"
                    name="geocodingUrl"
                    maxLength={255}
                    value={values.geocodingUrl}
                    showLabel={true}
                    onChange={handleChange}
                    style={{
                      borderColor:
                        errors.geocodingUrl && touched.geocodingUrl
                          ? 'red'
                          : '',
                    }}
                  />
                  <CustomTextField
                    type="text"
                    placeholder="https://router.project-osrm.org"
                    name="routingUrl"
                    maxLength={255}
                    value={values.routingUrl}
                    showLabel={true}
                    onChange={handleChange}
                    style={{
                      borderColor:
                        errors.routingUrl && touched.routingUrl ? 'red' : '',
                    }}
                  />
                </div>
              </ConfigCard>
            </Form>
          );
        }}
      </Formik>
    </div>
  );
};

export default GoogleApiAddForm;
