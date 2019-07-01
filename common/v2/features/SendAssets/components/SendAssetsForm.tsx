import React, { useContext } from 'react';
import { Formik, Form, Field, FieldProps, FastField } from 'formik';
import * as Yup from 'yup';
import { Button, Input } from '@mycrypto/ui';

import { WhenQueryExists } from 'components/renderCbs';
import { DeepPartial } from 'shared/types/util';
import translate, { translateRaw } from 'translations';
import { AccountContext } from 'v2/providers';
import {
  ExtendedAccount as IExtendedAccount,
  AssetBalanceObject,
  Asset,
  ExtendedAccount
} from 'v2/services';
// import { processFormDataToTx } from 'v2/libs/transaction/process';
import { IAsset, TSymbol } from 'v2/types';
import { InlineErrorMsg } from 'v2/components';
import { getNonce } from 'v2/features/Nonce';
import { getGasEstimate, fetchGasPriceEstimates } from 'v2/features/Gas';
import { ISendState, ITxFields } from '../types';
import {
  AccountDropdown,
  AssetDropdown,
  DataField,
  GasLimitField,
  GasPriceField,
  GasPriceSlider,
  NonceField
} from './fields';
import {
  validateDataField,
  validateGasLimitField,
  validateGasPriceField,
  validateNonceField,
  validateRecipientField
} from './validators/validators';
import './SendAssetsForm.scss';
import { getAssetByUUID, getNetworkByName } from 'v2/libs';
import { processFormDataToTx } from 'v2/libs/transaction/process';
import { GasEstimates } from 'v2/api/gas';
import { validateTxFields } from 'v2/libs/validators';

import TransactionFeeDisplay from './displays/TransactionFeeDisplay';
import TransactionValueDisplay from './displays/TransactionValuesDisplay';
import RecipientAddressField from './fields/EthAddressField';

interface Props {
  stateValues: ISendState;
  transactionFields: ITxFields;
  onNext(): void;
  onSubmit(transactionFields: ITxFields): void;
  updateState(state: DeepPartial<ISendState>): void;
}

const QueryWarning: React.SFC<{}> = () => (
  <WhenQueryExists
    whenQueryExists={
      <div className="alert alert-info">
        <p>{translate('WARN_SEND_LINK')}</p>
      </div>
    }
  />
);

const SendAssetsSchema = Yup.object().shape({
  amount: Yup.number().required(translateRaw('REQUIRED')),
  recipientAddress: Yup.string().required(translateRaw('REQUIRED')),
  account: Yup.object().required(translateRaw('REQUIRED')),
  asset: Yup.object().required(translateRaw('REQUIRED'))
});

export default function SendAssetsForm({
  transactionFields,
  onNext,
  onSubmit,
  updateState
}: Props) {
  const { accounts } = useContext(AccountContext);
  // @TODO:SEND change the data structure to get an object

  const accountAssets: AssetBalanceObject[] = accounts.flatMap(a => a.assets);

  const assets: IAsset[] = accountAssets
    .map((assetObj: AssetBalanceObject) => getAssetByUUID(assetObj.uuid))
    .filter((asset: Asset | undefined) => asset)
    .map((asset: Asset) => {
      return { symbol: asset.ticker as TSymbol, name: asset.name, network: asset.networkId };
    });

  return (
    <div className="SendAssetsForm">
      <Formik
        initialValues={transactionFields}
        validationSchema={SendAssetsSchema}
        validateOnChange={false}
        validateOnBlur={true}
        onSubmit={(fields: ITxFields) => {
          onSubmit(fields);
          onNext();
        }}
        render={({ errors, touched, setFieldValue, values, handleChange, submitForm }) => {
          const toggleAdvancedOptions = () =>
            setFieldValue('isAdvancedTransaction', !values.isAdvancedTransaction);

          const handleGasEstimate = async () => {
            if (!values || !values.network) {
              return;
            }
            if (validateTxFields(values)) {
              return;
            }
            const finalTx = processFormDataToTx(values);
            if (!finalTx) {
              return;
            }
            const gas = await getGasEstimate(values.network, finalTx);
            setFieldValue('gasLimitEstimated', gas);
          };

          const handleFieldReset = () => {
            setFieldValue('account', undefined);
            setFieldValue('recipientAddress', '');
            setFieldValue('amount', '');
          };

          const setAmountFieldToAssetMax = () =>
            // @TODO get asset balance and subtract gas cost
            setFieldValue('amount', '1000');

          const handleNonceEstimate = async (account: ExtendedAccount) => {
            if (!values || !values.network) {
              return;
            }
            const nonce: number = await getNonce(values.network, account);
            setFieldValue('nonceEstimated', nonce.toString());
          };

          return (
            <Form className="SendAssetsForm">
              {/* <React.Fragment>
                {'ITxFields123: '}
                <br />
                <pre style={{ fontSize: '0.5rem' }}>{JSON.stringify(errors, null, 2)}</pre>
              </React.Fragment>
              <br />*/}
              {'Formik Fields: '}
              <br />
              <pre style={{ fontSize: '0.75rem' }}>{`Gas Limit Estimated: ${
                values.gasLimitEstimated
              }`}</pre>
              <pre style={{ fontSize: '0.75rem' }}>{`RecipientAddress: ${
                values.recipientAddress
              }`}</pre>
              <pre style={{ fontSize: '0.75rem' }}>{`ResolvedNSAddress: ${
                values.resolvedNSAddress
              }`}</pre>
              <QueryWarning />

              {/* Asset */}
              <fieldset className="SendAssetsForm-fieldset">
                <label htmlFor="asset" className="input-group-header">
                  {translate('X_ASSET')}
                </label>
                <Field
                  name="asset"
                  component={({ field, form }: FieldProps) => (
                    <AssetDropdown
                      name={field.name}
                      value={field.value}
                      assets={assets}
                      onSelect={option => {
                        form.setFieldValue(field.name, option);
                        handleFieldReset();

                        if (option.network) {
                          fetchGasPriceEstimates(option.network).then((data: GasEstimates) => {
                            form.setFieldValue('gasEstimates', data);
                            form.setFieldValue('gasPriceSlider', data.fast.toString());
                          });
                          form.setFieldValue('network', getNetworkByName(option.network));
                          handleGasEstimate();
                        }
                      }}
                    />
                  )}
                />
              </fieldset>
              {/* Sender Address */}
              <fieldset className="SendAssetsForm-fieldset">
                <label htmlFor="account" className="input-group-header">
                  {translate('X_ADDRESS')}
                </label>
                <Field
                  name="account"
                  value={values.account}
                  component={({ field, form }: FieldProps) => (
                    <AccountDropdown
                      values={values}
                      name={field.name}
                      value={field.value}
                      accounts={accounts}
                      onSelect={(option: IExtendedAccount) => {
                        form.setFieldValue(field.name, option);
                        handleGasEstimate();
                        handleNonceEstimate(option);
                      }}
                    />
                  )}
                />
              </fieldset>
              {/* Recipient Address */}
              <fieldset className="SendAssetsForm-fieldset">
                <label htmlFor="recipientAddress" className="input-group-header">
                  {translate('SEND_ADDR')}
                </label>
                <Field
                  name="recipientAddress"
                  validate={(e: string) => {
                    validateRecipientField(e, values);
                  }}
                  component={({ field, form }: FieldProps) => (
                    <RecipientAddressField
                      {...field}
                      form={form}
                      handleGasEstimate={handleGasEstimate}
                      error={errors.recipientAddress}
                      touched={touched.recipientAddress}
                      values={values}
                      placeholder={translateRaw('TO_FIELD_PLACEHOLDER')}
                    />
                  )}
                />
              </fieldset>
              {/* Amount */}
              <fieldset className="SendAssetsForm-fieldset">
                <label htmlFor="amount" className="input-group-header label-with-action">
                  <div>{translate('SEND_ASSETS_AMOUNT_LABEL')}</div>
                  <div className="label-action" onClick={setAmountFieldToAssetMax}>
                    {translateRaw('SEND_ASSETS_AMOUNT_LABEL_ACTION').toLowerCase()}
                  </div>
                </label>
                <FastField
                  name="amount"
                  render={({ field }: FieldProps) => (
                    <Input value={field.value} placeholder={'0.00'} {...field} />
                  )}
                />
                {errors.amount && touched.amount ? (
                  <InlineErrorMsg className="SendAssetsForm-errors">{errors.amount}</InlineErrorMsg>
                ) : null}
              </fieldset>
              {/* You'll Send */}
              <fieldset className="SendAssetsForm-fieldset SendAssetsForm-fieldset-youllSend">
                <label>{translateRaw('YOU_WILL_SEND')}</label>
                <TransactionValueDisplay
                  amount={values.amount || '0.00'}
                  ticker={values.asset ? values.asset.symbol : ('ETH' as TSymbol)}
                  fiatAsset={{ ticker: 'USD' as TSymbol, exchangeRate: '250' }}
                />
              </fieldset>
              {/* Transaction Fee */}
              <fieldset className="SendAssetsForm-fieldset">
                <label htmlFor="transactionFee" className="SendAssetsForm-fieldset-transactionFee">
                  <div>{translateRaw('TX_FEE')}</div>

                  <TransactionFeeDisplay
                    values={values}
                    fiatAsset={{ fiat: 'USD', value: '250', symbol: '$' }}
                  />
                  {/* TRANSLATE THIS */}
                </label>
                {!values.isAdvancedTransaction && (
                  <GasPriceSlider
                    transactionFieldValues={values}
                    handleChange={(e: string) => {
                      handleGasEstimate();
                      updateState({ transactionFields: { gasPriceSlider: e } });
                      handleChange(e);
                    }}
                    gasPrice={values.gasPriceSlider}
                    gasEstimates={values.gasEstimates}
                  />
                )}
              </fieldset>
              {/* Advanced Options */}
              <div className="SendAssetsForm-advancedOptions">
                <Button
                  basic={true}
                  onClick={toggleAdvancedOptions}
                  className="SendAssetsForm-advancedOptions-button"
                >
                  {values.isAdvancedTransaction ? translateRaw('HIDE') : translateRaw('SHOW')}{' '}
                  {translateRaw('ADVANCED_SETTINGS')}
                </Button>
                {values.isAdvancedTransaction && (
                  <div className="SendAssetsForm-advancedOptions-content">
                    <div className="SendAssetsForm-advancedOptions-content-automaticallyCalculate">
                      <Field
                        name="isGasLimitManual"
                        type="checkbox"
                        checked={!values.isGasLimitManual}
                        onChange={() => setFieldValue('isGasLimitManual', !values.isGasLimitManual)}
                      />
                      <label htmlFor="isGasLimitManual">
                        {translateRaw('TRANS_AUTO_GAS_TOGGLE')}
                      </label>
                    </div>
                    <div className="SendAssetsForm-advancedOptions-content-priceLimitNonce">
                      <div className="SendAssetsForm-advancedOptions-content-priceLimitNonce-price">
                        <label htmlFor="gasPrice">{translate('OFFLINE_STEP2_LABEL_3')}</label>
                        <FastField
                          name="gasPriceField"
                          validate={validateGasPriceField}
                          render={({ field, form }: FieldProps<ITxFields>) => (
                            <GasPriceField
                              onChange={(option: string) => {
                                form.setFieldValue(field.name, option);
                              }}
                              name={field.name}
                              value={field.value}
                            />
                          )}
                        />
                      </div>
                      <div className="SendAssetsForm-advancedOptions-content-priceLimitNonce-price">
                        <label htmlFor="gasLimit">{translate('OFFLINE_STEP2_LABEL_4')}</label>
                        <Field
                          name="gasLimitField"
                          validate={(e: string) => {
                            if (values.isGasLimitManual) {
                              validateGasLimitField(e);
                            }
                          }}
                          render={({ field, form }: FieldProps<ITxFields>) => (
                            <GasLimitField
                              onChange={(option: string) => {
                                form.setFieldValue(field.name, option);
                              }}
                              disabled={!values.isGasLimitManual}
                              name={field.name}
                              value={field.value}
                            />
                          )}
                        />
                      </div>
                      <div className="SendAssetsForm-advancedOptions-content-priceLimitNonce-nonce">
                        <label htmlFor="nonce">{translateRaw('NONCE')}</label>
                        <FastField
                          name="nonceField"
                          validate={validateNonceField}
                          render={({ field, form }: FieldProps<ITxFields>) => (
                            <NonceField
                              onChange={(option: string) => {
                                form.setFieldValue(field.name, option);
                              }}
                              name={field.name}
                              value={field.value}
                            />
                          )}
                        />
                      </div>
                    </div>
                    <div className="SendAssetsForm-errors">
                      {errors.gasPriceField && (
                        <InlineErrorMsg>{errors.gasPriceField}</InlineErrorMsg>
                      )}
                      {errors.gasLimitField && (
                        <InlineErrorMsg>{errors.gasLimitField}</InlineErrorMsg>
                      )}
                      {errors.nonceField && <InlineErrorMsg>{errors.nonceField}</InlineErrorMsg>}
                    </div>
                    <fieldset className="SendAssetsForm-fieldset">
                      <label htmlFor="data">{translateRaw('DATA')}</label>
                      <FastField
                        name="data"
                        validate={validateDataField}
                        render={({ field, form }: FieldProps<ITxFields>) => (
                          <DataField
                            onChange={(option: string) => {
                              form.setFieldValue(field.name, option);
                            }}
                            errors={errors.data}
                            name={field.name}
                            value={field.value}
                          />
                        )}
                      />
                    </fieldset>
                    <div className="SendAssetsForm-advancedOptions-content-output">
                      0 + 13000000000 * 1500000 + 20000000000 * (180000 + 53000) = 0.02416 ETH ~=
                      {/* TRANSLATE THIS */}
                      $2.67 USD{/* TRANSLATE THIS */}
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" onClick={submitForm} className="SendAssetsForm-next">
                Next{/* TRANSLATE THIS */}
              </Button>
            </Form>
          );
        }}
      />
    </div>
  );
}
