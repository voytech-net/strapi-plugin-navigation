import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { debounce, find, get, isEmpty, isEqual, isNil, isString } from 'lodash';
import PropTypes from 'prop-types';
import { Formik } from 'formik'

// Design System
import { ModalBody } from '@strapi/design-system/ModalLayout';
import { Text } from '@strapi/design-system/Text';
import { Grid, GridItem } from '@strapi/design-system/Grid';
import { Flex } from '@strapi/design-system/Flex';
import { Form, GenericInput } from '@strapi/helper-plugin';
import Information from '@strapi/icons/Information';

import { NavigationItemPopupFooter } from '../NavigationItemPopup/NavigationItemPopupFooter';


import { navigationItemType } from '../../utils/enums';
import slugify from 'slugify';
import { extractRelatedItemLabel } from '../../utils/parsers';
import { form as formDefinition } from './utils/form';
import { checkFormValidity } from '../../utils/form';
import { getTrad, getTradId } from '../../../../translations';

const NavigationItemForm = ({
  isLoading,
  inputsPrefix,
  data = {},
  contentTypes = [],
  contentTypeEntities = [],
  usedContentTypeEntities = [],
  availableAudience = [],
  additionalFields = [],
  contentTypesNameFields = {},
  onSubmit,
  onCancel,
  getContentTypeEntities,
  usedContentTypesData,
  appendLabelPublicationStatus = () => '',
}) => {
  const [hasBeenInitialized, setInitializedState] = useState(false);
  const [hasChanged, setChangedState] = useState(false);
  const [contentTypeSearchQuery, setContentTypeSearchQuery] = useState(undefined);
  const [contentTypeSearchInputValue, setContentTypeSearchInputValue] = useState(undefined);
  const [form, setFormState] = useState({});
  const [formErrors, setFormErrorsState] = useState({});
  const { relatedType } = form;
  const { formatMessage } = useIntl();

  const relatedFieldName = `${inputsPrefix}related`;

  if (!hasBeenInitialized && !isEmpty(data)) {
    setInitializedState(true);
    setFormState({ ...data });
  }

  const sanitizePayload = (payload = {}) => {
    const { onItemClick, onItemLevelAddClick, related, relatedType, menuAttached, ...purePayload } = payload;
    const sanitizedType = purePayload.type || navigationItemType.INTERNAL;
    const relatedId = related?.value
    const relatedCollectionType = relatedType?.value;
    return {
      ...purePayload,
      menuAttached: isNil(menuAttached) ? false : menuAttached,
      type: sanitizedType,
      path: sanitizedType === navigationItemType.INTERNAL ? purePayload.path : undefined,
      externalPath: sanitizedType === navigationItemType.EXTERNAL ? purePayload.externalPath : undefined,
      related: relatedId,
      relatedType: relatedCollectionType,
      isSingle: isSingleSelected,
      uiRouterKey: generateUiRouterKey(purePayload.title, relatedId, relatedCollectionType),
    };
  };

  const handleSubmit = async e => {
    if (e) {
      e.preventDefault();
    }

    const payload = sanitizePayload(form);
    const errors = await checkFormValidity(payload, formDefinition.schema(isSingleSelected));
    if (!errors || isEmpty(errors)) {
      return onSubmit(payload);
    } else {
      setFormErrorsState(errors);
    }
  };

  const onTypeChange = ({ target: { name, value } }) =>
    onChange({ target: { name, value: value ? navigationItemType.INTERNAL : navigationItemType.EXTERNAL } });

  const onChange = ({ target: { name, value } }) => {
    setFormState(prevState => ({
      ...prevState,
      updated: true,
      [name]: value,
    }));
    if (!hasChanged) {
      setChangedState(true);
    }
  };

  const generateUiRouterKey = (title, related, relatedType) => {
    if (title) {
      return isString(title) && !isEmpty(title) ? slugify(title).toLowerCase() : undefined;
    } else if (related) {
      const relationTitle = extractRelatedItemLabel({
        ...contentTypeEntities.find(_ => _.id === related),
        __collectionName: relatedType
      }, contentTypesNameFields, { contentTypes });
      return isString(relationTitle) && !isEmpty(relationTitle) ? slugify(relationTitle).toLowerCase() : undefined;
    }
    return undefined;
  };

  const relatedTypeSelectValue = form.relatedType;
  const relatedSelectValue = form.related;

  const isSingleSelected = useMemo(
    () => relatedTypeSelectValue ? contentTypes.find(_ => _.uid === relatedType.value)?.isSingle : false,
    [relatedTypeSelectValue, contentTypes],
  );

  console.log("CTE", contentTypeEntities)
  const relatedSelectOptions = contentTypeEntities
  .filter((item) => {
      
      const usedContentTypeEntitiesOfSameType = usedContentTypeEntities
        .filter(uctItem => (get(relatedTypeSelectValue, 'value') === uctItem.__collectionName) && (uctItem.id !== get(relatedSelectValue, 'value')));
      return !find(usedContentTypeEntitiesOfSameType, uctItem => item.id === uctItem.id);
    })
    .map((item) => ({
      value: item.id,
      label: appendLabelPublicationStatus(
        extractRelatedItemLabel({
          ...item,
          __collectionName: get(relatedTypeSelectValue, 'value', relatedTypeSelectValue),
        }, contentTypesNameFields, { contentTypes }),
        item
      ),
    }));

  const isExternal = form.type === navigationItemType.EXTERNAL;
  const pathSourceName = isExternal ? 'externalPath' : 'path';

  const submitDisabled = (form.type !== navigationItemType.EXTERNAL) && isNil(form.related);

  const debouncedSearch = useCallback(
    debounce(nextValue => setContentTypeSearchQuery(nextValue), 500),
    [],
  );

  const debounceContentTypeSearchQuery = value => {
    setContentTypeSearchInputValue(value);
    debouncedSearch(value);
  };

  const onChangeRelatedType = ({ target: { name, value } }) => {
    const relatedTypeBeingReverted = data.relatedType && (data.relatedType.value === get(value, 'value', value));
    setContentTypeSearchQuery(undefined);
    setContentTypeSearchInputValue(undefined);
    setFormState(prevState => ({
      ...prevState,
      updated: true,
      related: relatedTypeBeingReverted ? {
        ...data.related
      } : undefined,
      [name]: value,
    }));
    if (!hasChanged) {
      setChangedState(true);
    }
  };

  const relatedTypeSelectOptions = useMemo(
    () => contentTypes
      .filter((contentType) => {
        if (contentType.isSingle) {
          return !usedContentTypesData.some((_) => _.__collectionName === contentType.uid);
        }
        return true;
      })
      .map((item) => ({
        key: get(item, 'uid'),
        metadatas: {
          intlLabel: {
            id: get(item, 'label', get(item, 'name')),
            defaultMessage: get(item, 'label', get(item, 'name')),
          }
        },
        value: get(item, 'uid'),
        label: appendLabelPublicationStatus(get(item, 'label', get(item, 'name')), item, true),
      })),
    [contentTypes, usedContentTypesData],
  );

  const thereAreNoMoreContentTypes = isEmpty(relatedSelectOptions) && !contentTypeSearchQuery;

  useEffect(
    () => {
      const value = get(relatedSelectOptions, '0');
      if (isSingleSelected && relatedSelectOptions.length === 1 && !isEqual(value, relatedSelectValue)) {
        onChange({ target: { name: relatedFieldName, value } });
      }
    },
    [isSingleSelected, relatedSelectOptions],
  );

  useEffect(() => {
    const value = relatedType;
    const fetchContentTypeEntities = async () => {
      if (value) {
        const item = find(
          contentTypes,
          (_) => _.uid === value,
        );
        console.log("EFC", item)
        if (item) {
          console.log(item)
          await getContentTypeEntities({
            type: item.endpoint || item.collectionName,
            query: contentTypeSearchQuery,
          }, item.plugin);
        }
      }
    };
    fetchContentTypeEntities();
  }, [relatedType, contentTypeSearchQuery]);

  return (
    <>
      <Formik>
        <Form>
          <ModalBody>
            <Grid gap={5}>
              <GridItem key={`${inputsPrefix}title`} col={12}>
                <GenericInput
                  autoFocused={true}
                  intlLabel={{
                    id: getTradId('popup.item.form.title.label'),
                    defaultMessage: 'Title',
                  }}
                  name={`${inputsPrefix}title`}
                  placeholder={{
                    id: getTradId('popup.item.form.title.placeholder'),
                    defaultMessage: 'e.g. Blog',
                  }}
                  type='text'
                  error={get(formErrors, `${inputsPrefix}title`)}
                  onChange={onChange}
                  value={get(form, `${inputsPrefix}title`, '')}
                />
              </GridItem>
              <GridItem key={`${inputsPrefix}menuAttached`} col={6} lg={12}>
                <GenericInput
                  intlLabel={{
                    id: getTradId('popup.item.form.menuAttached.label'),
                    defaultMessage: 'MenuAttached',
                  }}
                  name={`${inputsPrefix}menuAttached`}
                  type='bool'
                  error={get(formErrors, `${inputsPrefix}menuAttached`)}
                  onChange={onChange}
                  value={get(form, `${inputsPrefix}menuAttached`, '')}
                />
              </GridItem>
              <GridItem key={`${inputsPrefix}type`} col={6} lg={12}>
                <GenericInput
                  intlLabel={{
                    id: getTradId('popup.item.form.type.label'),
                    defaultMessage: 'Internal link',
                  }}
                  name={`${inputsPrefix}type`}
                  type='bool'
                  error={get(formErrors, `${inputsPrefix}type`)}
                  onChange={onTypeChange}
                  value={get(form, `${inputsPrefix}type`, '') === navigationItemType.INTERNAL}
                />
              </GridItem>
              <GridItem key={`${inputsPrefix}path`} col={12}>
                <GenericInput
                  intlLabel={{
                    id: getTradId(`popup.item.form.${pathSourceName}.label`),
                    defaultMessage: 'Path',
                  }}
                  name={`${inputsPrefix}title`}
                  placeholder={{
                    id: getTradId(`popup.item.form.${pathSourceName}.placeholder`),
                    defaultMessage: 'e.g. Blog',
                  }}
                  type='text'
                  error={get(formErrors, `${inputsPrefix}title`)}
                  onChange={onChange}
                  value={get(form, `${inputsPrefix}title`, '')}
                />
              </GridItem>
              {!isExternal && (
                <>
                  <GridItem col={6} lg={12}>
                    <GenericInput
                      type="select"
                      intlLabel={{
                        id: getTradId('popup.item.form.relatedType.label'),
                        defaultMessage: 'Related Type'
                      }}
                      placeholder={{
                        id: getTradId('popup.item.form.relatedType.placeholder'),
                        defaultMessage: 'Related Type'
                      }}
                      name={`${inputsPrefix}relatedType`}
                      error={get(formErrors, `${inputsPrefix}relatedType`)}
                      onChange={onChangeRelatedType}
                      options={relatedTypeSelectOptions}
                      value={relatedTypeSelectValue}
                    />
                  </GridItem>
                  {relatedTypeSelectValue && !isSingleSelected && (
                    <GridItem col={6} lg={12}>
                      <GenericInput
                        type="select"
                        intlLabel={{
                          id: getTradId('popup.item.form.related.label'),
                          defaultMessage: 'Related'
                        }}
                        placeholder={{
                          id: getTradId('popup.item.form.related.label'),
                          defaultMessage: 'Related'
                        }}
                        name={relatedFieldName}
                        error={get(formErrors, relatedFieldName)}
                        onChange={onChange}
                        onInputChange={debounceContentTypeSearchQuery}
                        inputValue={contentTypeSearchInputValue}
                        options={relatedSelectOptions}
                        value={relatedSelectValue}
                      />
                      {!isLoading && thereAreNoMoreContentTypes && (
                        <Flex marginTop="1px">
                          <Information/>
                          <Text
                            textColor="warning600"
                          >
                            {
                              formatMessage(getTrad('popup.item.form.related.empty'), {
                                contentTypeName: get(relatedTypeSelectValue, 'label')
                              })
                            }
                          </Text>
                        </Flex>
                      )}
                    </GridItem>
                  )}
                </>
              )}
            </Grid>
          </ModalBody>
        </Form>
      </Formik>
      <NavigationItemPopupFooter handleSubmit={handleSubmit} handleCancel={onCancel} submitDisabled={submitDisabled} />
    </>
  );
};

NavigationItemForm.defaultProps = {
  fieldsToDisable: [],
  formErrors: {},
  inputsPrefix: '',
  onSubmit: (e) => e.preventDefault(),
  requestError: null,
};

NavigationItemForm.propTypes = {
  isLoading: PropTypes.bool,
  fieldsToDisable: PropTypes.array,
  formErrors: PropTypes.object.isRequired,
  inputsPrefix: PropTypes.string,
  data: PropTypes.object.isRequired,
  onSubmit: PropTypes.func,
  requestError: PropTypes.object,
  contentTypes: PropTypes.array,
  contentTypeEntities: PropTypes.array,
  usedContentTypeEntities: PropTypes.array,
  availableAudience: PropTypes.array,
  additionalFields: PropTypes.array,
  getContentTypeEntities: PropTypes.func.isRequired,
  appendLabelPublicationStatus: PropTypes.func,
  onCancel: PropTypes.func,
};

export default NavigationItemForm;
