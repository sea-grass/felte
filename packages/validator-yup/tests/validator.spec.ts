import { expect, describe, test, vi } from 'vitest';
import { waitFor } from '@testing-library/dom';
import type { ValidationFunction } from '@felte/common';
import { createForm } from './common';
import { validateSchema, validator } from '../src';
import * as yup from 'yup';
import { get } from 'svelte/store';

describe('Validator yup', () => {
  test('correctly validates', async () => {
    const schema = yup.object({
      email: yup.string().email().required(),
      password: yup.string().required(),
    });
    const mockData = {
      email: '',
      password: '',
    };
    const { validate, errors, data } = createForm({
      initialValues: mockData,
      onSubmit: vi.fn(),
      validate: validateSchema(schema),
    });

    await validate();

    expect(get(data)).to.deep.equal(mockData);
    expect(get(errors)).to.deep.equal({
      email: ['email is a required field'],
      password: ['password is a required field'],
    });

    data.set({
      email: 'test@email.com',
      password: 'test',
    });

    await validate();

    expect(get(errors)).to.deep.equal({
      email: null,
      password: null,
    });
  });

  test('correctly validates deep form', async () => {
    const schema = yup.object({
      account: yup.object({
        email: yup.string().email().required(),
        password: yup.string().required(),
      }),
    });
    const mockData = {
      account: {
        email: '',
        password: '',
      },
    };
    const { validate, errors, data } = createForm({
      initialValues: mockData,
      onSubmit: vi.fn(),
      validate: validateSchema(schema),
    });

    await validate();

    expect(get(data)).to.deep.equal(mockData);
    expect(get(errors)).to.deep.equal({
      account: {
        email: ['account.email is a required field'],
        password: ['account.password is a required field'],
      },
    });

    data.set({
      account: {
        email: 'test@email.com',
        password: 'test',
      },
    });

    await validate();

    expect(get(errors)).to.deep.equal({
      account: {
        email: null,
        password: null,
      },
    });
  });

  test('correctly validates with extend', async () => {
    const schema = yup.object({
      email: yup.string().email().required(),
      password: yup.string().required(),
    });
    const warnSchema = yup.object({
      password: yup
        .string()
        .test('is-secure', 'password is not secure', (value) =>
          value ? value.length > 8 : true
        ),
    });
    const mockData = {
      email: '',
      password: '',
    };
    const { validate, errors, warnings, data } = createForm<typeof mockData>({
      initialValues: mockData,
      onSubmit: vi.fn(),
      extend: [
        validator({ schema }),
        validator({ schema: warnSchema, level: 'warning' }),
      ],
    });

    await validate();

    expect(get(data)).to.deep.equal(mockData);
    expect(get(errors)).to.deep.equal({
      email: ['email is a required field'],
      password: ['password is a required field'],
    });
    expect(get(warnings)).to.deep.equal({
      email: null,
      password: null,
    });

    data.set({
      email: 'test@email.com',
      password: 'test',
    });

    await validate();

    expect(get(errors)).to.deep.equal({
      email: null,
      password: null,
    });
    expect(get(warnings)).to.deep.equal({
      email: null,
      password: ['password is not secure'],
    });
  });

  test('correctly validates deep form with extend', async () => {
    const schema = yup.object({
      account: yup.object({
        email: yup.string().email().required(),
        password: yup.string().required(),
      }),
    });
    const mockData = {
      account: {
        email: '',
        password: '',
      },
    };
    type Data = yup.InferType<typeof schema>;
    const { validate, errors, data } = createForm<Data>({
      initialValues: mockData,
      onSubmit: vi.fn(),
      extend: validator({ schema }),
    });

    await validate();

    expect(get(data)).to.deep.equal(mockData);
    expect(get(errors)).to.deep.equal({
      account: {
        email: ['account.email is a required field'],
        password: ['account.password is a required field'],
      },
    });

    data.set({
      account: {
        email: 'test@email.com',
        password: 'test',
      },
    });

    await validate();

    expect(get(errors)).to.deep.equal({
      account: {
        email: null,
        password: null,
      },
    });
  });

  test('correctly validates deep form with other validate', async () => {
    const schema = yup.object({
      account: yup.object({
        email: yup.string().email().required(),
        password: yup.string().required(),
      }),
    });
    type Data = yup.InferType<typeof schema>;
    const mockData = {
      account: {
        email: '',
        password: '',
      },
    };
    const { validate, errors, data } = createForm<Data>({
      initialValues: mockData,
      onSubmit: vi.fn(),
      extend: validator({ schema }),
      validate: vi.fn(() => ({
        account: {
          email: ['not an email'],
        },
      })) as ValidationFunction<any>,
    });

    await validate();

    expect(get(data)).to.deep.equal(mockData);
    expect(get(errors)).to.deep.equal({
      account: {
        email: ['not an email', 'account.email is a required field'],
        password: ['account.password is a required field'],
      },
    });

    data.set({
      account: {
        email: 'test@email.com',
        password: 'test',
      },
    });

    await validate();

    expect(get(errors)).to.deep.equal({
      account: {
        email: ['not an email'],
        password: null,
      },
    });
  });

  test('casts values', async () => {
    const schema = yup.object({
      shouldBeNumber: yup
        .mixed()
        .test('number', 'not a number', (value) => !isNaN(value))
        .transform((value) => parseInt(value, 10)),
    });
    const { data, errors, validate } = createForm<any>({
      extend: validator({ schema, castValues: true }),
      onSubmit: vi.fn(),
    });

    data.set({
      shouldBeNumber: '',
    });

    await validate();

    expect(get(data)).to.deep.equal({
      shouldBeNumber: NaN,
    });

    expect(get(errors)).to.deep.equal({
      shouldBeNumber: ['not a number'],
    });

    data.set({
      shouldBeNumber: '42',
    });

    expect(get(data)).to.deep.equal({
      shouldBeNumber: 42,
    });

    await waitFor(() => {
      expect(get(errors)).to.deep.equal({
        shouldBeNumber: null,
      });
    });
  });

  test('does not call addValidator when stage is not `SETUP`', () => {
    const schema = yup.object({});
    const addValidator = vi.fn();
    const validate = validator({ schema });
    validate({ stage: 'SETUP', addValidator } as any);
    expect(addValidator).toHaveBeenCalled();

    addValidator.mockClear();
    validate({ stage: 'MOUNT', addValidator } as any);
    expect(addValidator).not.toHaveBeenCalled();
  });
});
