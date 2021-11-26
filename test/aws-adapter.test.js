/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
/* eslint-env mocha */
const { Request, Response } = require('@adobe/helix-fetch');
const assert = require('assert');
const proxyquire = require('proxyquire').noCallThru();

const DEFAULT_EVENT = {
  version: '2.0',
  routeKey: 'ANY /dump',
  rawPath: '/dump',
  rawQueryString: '',
  headers: {
    accept: '*/*',
    'content-length': '0',
    host: 'kvvyh7ikcb.execute-api.us-east-1.amazonaws.com',
    'user-agent': 'curl/7.64.1',
    'x-amzn-trace-id': 'Root=1-603df0bb-05e846307a6221f72030fe68',
    'x-forwarded-for': '210.153.232.90',
    'x-forwarded-port': '443',
    'x-forwarded-proto': 'https',
  },
  requestContext: {
    accountId: '118435662149',
    apiId: 'kvvyh7ikcb',
    domainName: 'kvvyh7ikcb.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'kvvyh7ikcb',
    http: {
      method: 'GET',
      path: '/dump',
      protocol: 'HTTP/1.1',
      sourceIp: '210.153.232.90',
      userAgent: 'curl/7.64.1',
    },
    requestId: 'bjKNYhHcoAMEJIw=',
    routeKey: 'ANY /dump',
    stage: '$default',
    time: '02/Mar/2021:08:00:59 +0000',
    timeEpoch: 1614672059918,
  },
  isBase64Encoded: false,
};

const DEFAULT_CONTEXT = {
  getRemainingTimeInMillis: () => 30000,
  callbackWaitsForEmptyEventLoop: true,
  functionVersion: '$LATEST',
  functionName: 'dump',
  memoryLimitInMB: '128',
  logGroupName: '/aws/lambda/dump',
  logStreamName: '2021/03/02/[$LATEST]89b58159f93949f787eb8de043937bbb',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:118435662149:function:helix-pages--dump:4_3_1',
  awsRequestId: '535f0399-9c90-4042-880e-620cfec6af55',
};

describe('Adapter tests for AWS', () => {
  beforeEach(() => {
    process.env.AWS_TEST_PARAM = '123';
  });

  afterEach(() => {
    delete process.env.AWS_TEST_PARAM;
  });

  it('context.func', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: (request, context) => {
          assert.deepEqual(context.func, {
            name: 'dump',
            package: 'helix-pages',
            version: '4.3.1',
            fqn: 'arn:aws:lambda:us-east-1:118435662149:function:helix-pages--dump:4_3_1',
            app: 'kvvyh7ikcb',
          });
          return new Response('ok');
        },
      },
      './aws-package-params.js': () => ({}),
    });
    const res = await lambda(DEFAULT_EVENT, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 200);
  });

  it('when run with no version in functionArn use $LATEST', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: (request, context) => {
          assert.deepEqual(context.func, {
            name: 'dump',
            package: 'helix-pages',
            version: '$LATEST',
            fqn: 'arn:aws:lambda:us-east-1:118435662149:function:helix-pages--dump',
            app: 'kvvyh7ikcb',
          });
          return new Response('ok');
        },
      },
      './aws-package-params.js': () => ({}),
    });
    const res = await lambda(DEFAULT_EVENT, {
      ...DEFAULT_CONTEXT,
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:118435662149:function:helix-pages--dump',
    });
    assert.equal(res.statusCode, 200);
  });

  it('provides package params, local env wins', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: (request, context) => new Response(JSON.stringify(context.env)),
      },
      './aws-package-params.js': () => ({
        SOME_SECRET: 'pssst',
        AWS_TEST_PARAM: 'abc',
      }),
    });
    const res = await lambda(DEFAULT_EVENT, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    Object.keys(process.env)
      .filter((key) => key !== 'AWS_TEST_PARAM')
      .forEach((key) => delete body[key]);
    assert.deepEqual(body, {
      SOME_SECRET: 'pssst',
      AWS_TEST_PARAM: '123',
    });
  });

  it('raw adapter doesnt call package params', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: (request, context) => new Response(JSON.stringify(context.env)),
      },
      './aws-package-params.js': () => {
        throw Error('should not be called.');
      },
    });
    const res = await lambda.raw(DEFAULT_EVENT, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    Object.keys(process.env).forEach((key) => delete body[key]);
    assert.deepEqual(body, {
    });
  });

  it('context.invocation', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: (request, context) => {
          delete context.invocation.deadline;
          assert.deepEqual(context.invocation, {
            id: '535f0399-9c90-4042-880e-620cfec6af55',
            requestId: 'bjKNYhHcoAMEJIw=',
            transactionId: 'Root=1-603df0bb-05e846307a6221f72030fe68',
          });
          return new Response('ok');
        },
      },
      './aws-package-params.js': () => ({}),
    });
    const res = await lambda(DEFAULT_EVENT, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.headers, {
      'content-type': 'text/plain; charset=utf-8',
      'x-invocation-id': '535f0399-9c90-4042-880e-620cfec6af55',
    });
  });

  it('context.invocation (external transaction id)', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: (request, context) => {
          delete context.invocation.deadline;
          assert.deepEqual(context.invocation, {
            id: '535f0399-9c90-4042-880e-620cfec6af55',
            requestId: 'bjKNYhHcoAMEJIw=',
            transactionId: 'my-tx-id',
          });
          return new Response('ok');
        },
      },
      './aws-package-params.js': () => ({}),
    });
    const res = await lambda({
      ...DEFAULT_EVENT,
      headers: {
        ...DEFAULT_EVENT.headers,
        'x-transaction-id': 'my-tx-id',
      },
    }, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 200);
  });

  it('handles illegal request headers with 400', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: () => new Response('ok'),
      },
      './aws-package-params.js': () => ({}),
    });
    const res = await lambda({
      ...DEFAULT_EVENT,
      headers: {
        host: 'kvvyh7ikcb.execute-api.us-east-1.amazonaws.com',
        accept: 'жsome value',
      },
    }, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.headers, {
      'content-type': 'text/plain',
      'x-invocation-id': '535f0399-9c90-4042-880e-620cfec6af55',
    });
  });

  it('handles error in function', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: () => {
          throw new Error('function kaput');
        },
      },
      './aws-package-params.js': () => ({}),
    });
    const res = await lambda({
      ...DEFAULT_EVENT,
      headers: {
        host: 'kvvyh7ikcb.execute-api.us-east-1.amazonaws.com',
      },
    }, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.headers, {
      'content-type': 'text/plain',
      'x-error': 'function kaput',
      'x-invocation-id': '535f0399-9c90-4042-880e-620cfec6af55',
    });
  });

  it('handles error in epsagon wrapper', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: () => {
          throw new Error('function kaput');
        },
      },
      './aws-package-params.js': () => {
        throw new Error('epsagon wrapper kaput');
      },
    });
    const res = await lambda({
      ...DEFAULT_EVENT,
      headers: {
        host: 'kvvyh7ikcb.execute-api.us-east-1.amazonaws.com',
      },
    }, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.headers, {
      'content-type': 'text/plain',
      'x-error': 'epsagon wrapper kaput',
      'x-invocation-id': '535f0399-9c90-4042-880e-620cfec6af55',
    });
  });

  it('flushes log', async () => {
    let logFlushed = 0;
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: (req, ctx) => {
          ctx.log = {
            flush() {
              logFlushed += 1;
            },
          };
          return new Response('ok');
        },
      },
      './aws-package-params.js': () => ({}),
    });
    const res = await lambda(DEFAULT_EVENT, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 200);
    assert.equal(logFlushed, 1);
  });

  it('handle binary request body', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        // eslint-disable-next-line no-unused-vars
        main: async (request, context) => {
          assert.deepEqual(await request.json(), { goo: 'haha' });
          return new Response('okay');
        },
        '@noCallThru': true,
      },
      './aws-package-params.js': () => ({}),
    });

    const res = await lambda({
      ...DEFAULT_EVENT,
      body: 'eyJnb28iOiJoYWhhIn0=',
      requestContext: {
        ...DEFAULT_EVENT.requestContext,
        http: {
          method: 'POST',
          path: '/dump',
          protocol: 'HTTP/1.1',
        },
      },
      isBase64Encoded: true,
      headers: {
        host: 'kvvyh7ikcb.execute-api.us-east-1.amazonaws.com',
        'content-type': 'application/json',
      },
    }, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 200);
  });

  it('handle binary response body', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        // eslint-disable-next-line no-unused-vars
        main: async (request, context) => new Response(Buffer.from('binary', 'utf-8'), {
          headers: {
            'content-type': 'application/octet-stream',
          },
        }),
        '@noCallThru': true,
      },
      './aws-package-params.js': () => ({}),
    });

    const res = await lambda(DEFAULT_EVENT, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 200);
    assert.equal(res.isBase64Encoded, true);
    assert.equal(Buffer.from(res.body, 'base64').toString('utf-8'), 'binary');
  });

  it('handles request params', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        // eslint-disable-next-line no-unused-vars
        main: async (request, context) => {
          const url = new URL(request.url);
          assert.equal(url.searchParams.get('foo'), 'bar');
          return new Response('okay');
        },
        '@noCallThru': true,
      },
      './aws-package-params.js': () => ({}),
    });

    const res = await lambda({
      ...DEFAULT_EVENT,
      rawQueryString: 'foo=bar',
      headers: {
        host: 'kvvyh7ikcb.execute-api.us-east-1.amazonaws.com',
      },
    }, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 200);
  });

  it('handles event cookies params', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        // eslint-disable-next-line no-unused-vars
        main: async (request, context) => {
          assert.deepStrictEqual(request.headers.plain(), {
            cookie: 'name1=value1;name2=value2',
            host: 'kvvyh7ikcb.execute-api.us-east-1.amazonaws.com',
          });
          return new Response('okay');
        },
        '@noCallThru': true,
      },
      './aws-package-params.js': () => ({}),
    });

    const res = await lambda({
      ...DEFAULT_EVENT,
      cookies: [
        'name1=value1',
        'name2=value2',
      ],
      rawQueryString: 'foo=bar',
      headers: {
        host: 'kvvyh7ikcb.execute-api.us-east-1.amazonaws.com',
      },
    }, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 200);
  });

  it('handles preserves cookie header', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        // eslint-disable-next-line no-unused-vars
        main: async (request, context) => {
          assert.deepStrictEqual(request.headers.plain(), {
            cookie: 'name1=value1;name2=value2',
            host: 'kvvyh7ikcb.execute-api.us-east-1.amazonaws.com',
          });
          return new Response('okay');
        },
        '@noCallThru': true,
      },
      './aws-package-params.js': () => ({}),
    });

    const res = await lambda({
      ...DEFAULT_EVENT,
      cookies: [
      ],
      rawQueryString: 'foo=bar',
      headers: {
        host: 'kvvyh7ikcb.execute-api.us-east-1.amazonaws.com',
        cookie: 'name1=value1;name2=value2',
      },
    }, DEFAULT_CONTEXT);
    assert.equal(res.statusCode, 200);
  });

  it('can be run without requestContext', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: (request, context) => {
          assert.deepStrictEqual(context.func, {
            name: 'dump',
            package: 'helix-pages',
            version: '4.3.1',
            fqn: 'arn:aws:lambda:us-east-1:118435662149:function:helix-pages--dump:4_3_1',
            app: undefined,
          });
          const { searchParams } = new URL(request.url);
          assert.strictEqual(searchParams.toString(), 'key1=value1&key2=value2&key3=value3');
          return new Response('ok');
        },
      },
      './aws-package-params.js': () => ({}),
    });
    const res = await lambda(
      {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
        other: {},
      },
      DEFAULT_CONTEXT,
    );
    assert.equal(res.statusCode, 200);
  });

  it('can be run as a trigger with context.records', async () => {
    const messageBody = {
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    };
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: async (request, context) => {
          if (context.records) {
            const { body } = context.records[0];
            // eslint-disable-next-line no-param-reassign
            request = new Request(request.url, {
              method: 'POST', body, headers: { 'content-type': 'application/json' },
            });
          }
          assert.deepStrictEqual(context.func, {
            name: 'dump',
            package: 'helix-pages',
            version: '4.3.1',
            fqn: 'arn:aws:lambda:us-east-1:118435662149:function:helix-pages--dump:4_3_1',
            app: undefined,
          });
          const json = await request.json();
          assert.deepStrictEqual(json, messageBody);
          return new Response('ok');
        },
      },
      './aws-package-params.js': () => ({}),
    });
    const res = await lambda(
      {
        Records: [{
          body: JSON.stringify(messageBody, null, 2),
        }],
      },
      DEFAULT_CONTEXT,
    );
    assert.equal(res.statusCode, 200);
  });

  it('handles errors when run without requestContext', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: () => {
          throw new Error('function kaput');
        },
      },
      './aws-package-params.js': () => ({}),
    });
    await assert.rejects(async () => lambda(
      {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
        other: {},
      },
      DEFAULT_CONTEXT,
    ));
  });

  it('handles errors from lambda setup when run without requestContext', async () => {
    const lambda = proxyquire('../src/aws-adapter.js', {
      './main.js': {
        main: () => {
          throw new Error('function kaput');
        },
      },
      './aws-package-params.js': () => {
        throw new Error('package params kaput');
      },
    });
    await assert.rejects(async () => lambda(
      {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
        other: {},
      },
      DEFAULT_CONTEXT,
    ));
  });
});
