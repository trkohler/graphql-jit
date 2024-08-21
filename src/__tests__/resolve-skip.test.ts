import { DocumentNode, GraphQLSchema, parse } from "graphql";
import { compileQuery } from "../execution";
import { makeExecutableSchema } from "@graphql-tools/schema";

function executeQuery(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: any,
  vars?: any
) {
  const prepared: any = compileQuery(schema, document, "");
  if (prepared.errors) {
    return prepared;
  }
  return prepared.query(rootValue, undefined, vars);
}

describe("@skip/include behaviours spec for debugging", () => {
  const strSchema = /* GraphQL */ `
    type Article {
      id: ID!
      subarticle: Subarticle!
    }

    type Subarticle {
      id: ID!
    }

    type Query {
      article: Article!
    }
  `;
  const articleResolver = jest.fn(() => {
    return { id: "1" };
  });
  const subarticleResolver = jest.fn(() => {
    return { id: "1" };
  });
  const articleImplicitResolver = jest.fn(() => {
    return { id: "1", subarticle: subarticleResolver() };
  });

  const articleResolverWithLookahead = jest.fn(
    (parent, args, context, info) => {
      const firstField = info.fieldNodes[0];
      const selections = firstField.selectionSet.selections;
      const subarticleSelected = selections.some(
        (selection: any) => selection.name.value === "subarticle"
      );

      if (subarticleSelected) {
        return { id: "1", subarticle: subarticleResolver() };
      }
      return { id: "1" };
    }
  );

  const explicitlyDefinedResolvers = {
    Query: {
      article: articleResolver
    },
    Article: {
      subarticle: subarticleResolver
    }
  };

  const implicitlyDefinedResolvers = {
    Query: {
      article: articleImplicitResolver
    }
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("explicit resolvers", () => {
    test("if parent is skipped, child resolver should not be called", () => {
      const query = /* GraphQL */ `
        query ($shouldSkip: Boolean!) {
          article @skip(if: $shouldSkip) {
            id
            subarticle {
              id
            }
          }
        }
      `;

      const graphqlSchema = makeExecutableSchema({
        typeDefs: strSchema,
        resolvers: explicitlyDefinedResolvers
      });
      const queryDocument = parse(query);
      const result = executeQuery(graphqlSchema, queryDocument, undefined, {
        shouldSkip: true
      });
      expect(result).toEqual({ data: { article: undefined } });
      expect(articleResolver).not.toHaveBeenCalled();
      expect(subarticleResolver).not.toHaveBeenCalled();
    });

    test("if parent is included, child resolver should be called", () => {
      const query = /* GraphQL */ `
        query ($shouldSkip: Boolean!) {
          article @skip(if: $shouldSkip) {
            id
            subarticle {
              id
            }
          }
        }
      `;
      const graphqlSchema = makeExecutableSchema({
        typeDefs: strSchema,
        resolvers: explicitlyDefinedResolvers
      });
      const queryDocument = parse(query);
      const result = executeQuery(graphqlSchema, queryDocument, undefined, {
        shouldSkip: false
      });

      expect(result).toEqual({
        data: { article: { id: "1", subarticle: { id: "1" } } }
      });
      expect(articleResolver).toHaveBeenCalledTimes(1);
      expect(subarticleResolver).toHaveBeenCalledTimes(1);
    });

    test("if parent is skipped and there are several children resolvers, noone of those should be called", () => {
      const query = /* GraphQL */ `
        query ($shouldSkip: Boolean!) {
          article @skip(if: $shouldSkip) {
            id
            subarticleCall1: subarticle {
              id
            }
            subarticleCall2: subarticle {
              id
            }
          }
        }
      `;
      const graphqlSchema = makeExecutableSchema({
        typeDefs: strSchema,
        resolvers: explicitlyDefinedResolvers
      });
      const queryDocument = parse(query);
      const result = executeQuery(graphqlSchema, queryDocument, undefined, {
        shouldSkip: true
      });
      expect(result).toEqual({ data: { article: undefined } });
      expect(articleResolver).not.toHaveBeenCalled();
      expect(subarticleResolver).not.toHaveBeenCalled();
    });
  });

  describe("implicit resolvers", () => {
    test("if parent is skipped, child resolver should not be called", () => {
      const query = /* GraphQL */ `
        query ($shouldSkip: Boolean!) {
          article @skip(if: $shouldSkip) {
            id
            subarticle {
              id
            }
          }
        }
      `;
      const graphqlSchema = makeExecutableSchema({
        typeDefs: strSchema,
        resolvers: implicitlyDefinedResolvers
      });
      const queryDocument = parse(query);
      const result = executeQuery(graphqlSchema, queryDocument, undefined, {
        shouldSkip: true
      });
      expect(result).toEqual({ data: { article: undefined } });
      expect(articleImplicitResolver).not.toHaveBeenCalled();
      expect(subarticleResolver).not.toHaveBeenCalled();
    });

    test("if parent is included, child resolver should be called", () => {
      const query = /* GraphQL */ `
        query ($shouldSkip: Boolean!) {
          article @skip(if: $shouldSkip) {
            id
            subarticle {
              id
            }
          }
        }
      `;
      const graphqlSchema = makeExecutableSchema({
        typeDefs: strSchema,
        resolvers: implicitlyDefinedResolvers
      });
      const queryDocument = parse(query);
      const result = executeQuery(graphqlSchema, queryDocument, undefined, {
        shouldSkip: false
      });

      expect(result).toEqual({
        data: { article: { id: "1", subarticle: { id: "1" } } }
      });
      expect(articleImplicitResolver).toHaveBeenCalledTimes(1);
      expect(subarticleResolver).toHaveBeenCalledTimes(1);
    });

    test("if parent is skipped and there are several children resolvers, noone of those should be called", () => {
      const query = /* GraphQL */ `
        query ($shouldSkip: Boolean!) {
          article @skip(if: $shouldSkip) {
            id
            subarticleCall1: subarticle {
              id
            }
            subarticleCall2: subarticle {
              id
            }
          }
        }
      `;
      const graphqlSchema = makeExecutableSchema({
        typeDefs: strSchema,
        resolvers: implicitlyDefinedResolvers
      });
      const queryDocument = parse(query);
      const result = executeQuery(graphqlSchema, queryDocument, undefined, {
        shouldSkip: true
      });
      expect(result).toEqual({ data: { article: undefined } });
      expect(articleImplicitResolver).not.toHaveBeenCalled();
      expect(subarticleResolver).not.toHaveBeenCalled();
    });
  });

  describe("implicit resolvers with lookaheads", () => {
    test("if parent is skipped, child resolver should not be called", () => {
      const query = /* GraphQL */ `
        query ($shouldSkip: Boolean!) {
          article @skip(if: $shouldSkip) {
            id
            subarticle {
              id
            }
          }
        }
      `;
      const graphqlSchema = makeExecutableSchema({
        typeDefs: strSchema,
        resolvers: {
          Query: {
            article: articleResolverWithLookahead
          },
          Article: {
            subarticle: subarticleResolver
          }
        }
      });
      const queryDocument = parse(query);
      const result = executeQuery(graphqlSchema, queryDocument, undefined, {
        shouldSkip: true
      });
      expect(result).toEqual({ data: { article: undefined } });
      expect(articleResolverWithLookahead).not.toHaveBeenCalled();
      expect(subarticleResolver).not.toHaveBeenCalled();
    });

    test("if parent is included, we should call lookahead resolver", () => {
      const query = /* GraphQL */ `
        query ($shouldSkip: Boolean!) {
          article @skip(if: $shouldSkip) {
            id
            subarticle {
              id
            }
          }
        }
      `;
      const graphqlSchema = makeExecutableSchema({
        typeDefs: strSchema,
        resolvers: {
          Query: {
            article: articleResolverWithLookahead
          }
        }
      });
      const queryDocument = parse(query);
      const result = executeQuery(graphqlSchema, queryDocument, undefined, {
        shouldSkip: false
      });
      expect(result).toEqual({
        data: {
          article: {
            id: "1",
            subarticle: { id: "1" }
          }
        }
      });
      expect(articleResolverWithLookahead).toHaveBeenCalledTimes(1);
      expect(subarticleResolver).toHaveBeenCalledTimes(1);
    });

    test.only("parent is included, but child is skipped, we call subarticle resolver anyway", () => {
      const query = /* GraphQL */ `
        query ($shouldSkip: Boolean!) {
          article {
            id
            subarticle @skip(if: $shouldSkip) {
              id
            }
          }
        }
      `;
      const graphqlSchema = makeExecutableSchema({
        typeDefs: strSchema,
        resolvers: {
          Query: {
            article: articleResolverWithLookahead
          }
        }
      });
      const queryDocument = parse(query);
      const result = executeQuery(graphqlSchema, queryDocument, undefined, {
        shouldSkip: true
      });
      expect(result).toEqual({
        data: { article: { id: "1", subarticle: undefined } }
      });
      expect(articleResolverWithLookahead).toHaveBeenCalledTimes(1);
      expect(subarticleResolver).not.toHaveBeenCalled(); // this is the issue. We want to escape the call to subarticleResolver, but we can't!
      // by default, the resolver (JS function) is being executed from the beginning to the end.
      // GraphQL afterwards throw away the result for the child field, so have "correct" { subarticle: undefined }.
      // but if subarticle resolver contains expensive work, we'd do it each time regardless of field state ("skipped").
    });
  });

  describe("anonymous fragments", () => {
    // TODO: write me.
  });

  describe("named fragments", () => {
    // TODO: write me.
  });

  describe("interfaces and unions", () => {
    // TODO: write me.
  });

  describe("aliases", () => {
    // TODO: write me.
  });
});
