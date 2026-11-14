'use client';
// Core
import { Form, Formik } from 'formik';

// Components
import ConfigCard from '../../view/card';

// Toast
import useToast from '@/lib/hooks/useToast';

// Hooks
import { useConfiguration } from '@/lib/hooks/useConfiguration';

// Interfaces and Types
import { ICoinsForm } from '@/lib/utils/interfaces/configurations.interface';

// Utils and Constants
import { CoinsValidationSchema } from '@/lib/utils/schema';

// GraphQL
import {
  GET_CONFIGURATION,
  SAVE_COINS_CONFIGURATION,
} from '@/lib/api/graphql';
import { useMutation } from '@apollo/client';

const inputClass =
  'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none dark:border-dark-600 dark:bg-transparent';

const CoinsAddForm = () => {
  // Hooks
  const { COINS_ENABLED, COINS_PER_CURRENCY_UNIT, COIN_VALUE, CURRENT_SYMBOL } =
    useConfiguration();
  const { showToast } = useToast();

  const initialValues: ICoinsForm = {
    coinsEnabled: COINS_ENABLED,
    coinsPerCurrencyUnit: COINS_PER_CURRENCY_UNIT,
    coinValue: COIN_VALUE,
  };

  const [mutate, { loading: mutationLoading }] = useMutation(
    SAVE_COINS_CONFIGURATION,
    {
      refetchQueries: [{ query: GET_CONFIGURATION }],
    }
  );

  const handleSubmit = (values: ICoinsForm) => {
    mutate({
      variables: {
        configurationInput: {
          coinsEnabled: values.coinsEnabled,
          coinsPerCurrencyUnit: Number(values.coinsPerCurrencyUnit),
          coinValue: Number(values.coinValue),
        },
      },
      onCompleted: () => {
        showToast({
          type: 'success',
          title: 'Success!',
          message: 'Coins Configurations Updated',
          duration: 3000,
        });
      },
      onError: (error) => {
        let message = '';
        try {
          message = error.graphQLErrors[0]?.message;
        } catch (err) {
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
        validationSchema={CoinsValidationSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {({ values, errors, touched, handleSubmit, setFieldValue }) => {
          const rate = Number(values.coinsPerCurrencyUnit) || 0;
          const example = Math.floor(100 * rate + 1e-9);
          return (
            <Form onSubmit={handleSubmit}>
              <ConfigCard
                cardTitle={'Coins (Loyalty)'}
                buttonLoading={mutationLoading}
                toggleLabel={'Status'}
                toggleOnChange={() =>
                  setFieldValue('coinsEnabled', !values.coinsEnabled)
                }
                toggleValue={values.coinsEnabled}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-y-1">
                    <label className="text-sm font-[500]">
                      Coins earned per 1 {CURRENT_SYMBOL || 'currency unit'}{' '}
                      spent
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      className={inputClass}
                      style={{
                        borderColor:
                          errors.coinsPerCurrencyUnit &&
                          touched.coinsPerCurrencyUnit
                            ? 'red'
                            : '',
                      }}
                      value={values.coinsPerCurrencyUnit ?? ''}
                      onChange={(e) =>
                        setFieldValue(
                          'coinsPerCurrencyUnit',
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                    />
                    <span className="text-xs text-gray-500">
                      Example: 0.1 = 1 coin for every 10. A 100 order earns{' '}
                      {example} coins. Based on the order subtotal, credited
                      when the order is delivered.
                    </span>
                  </div>
                  <div className="flex flex-col gap-y-1">
                    <label className="text-sm font-[500]">
                      Value of 1 coin ({CURRENT_SYMBOL || 'currency'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      className={inputClass}
                      style={{
                        borderColor:
                          errors.coinValue && touched.coinValue ? 'red' : '',
                      }}
                      value={values.coinValue ?? ''}
                      onChange={(e) =>
                        setFieldValue(
                          'coinValue',
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                    />
                    <span className="text-xs text-gray-500">
                      Shown to customers as the money equivalent of their
                      balance.
                    </span>
                  </div>
                </div>
              </ConfigCard>
            </Form>
          );
        }}
      </Formik>
    </div>
  );
};

export default CoinsAddForm;
