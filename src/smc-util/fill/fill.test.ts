import { fill } from "./fill";
import { expectType } from "tsd";

test("Supplied default should be merged in to target", () => {
  const opts: { name: string; height?: number } = {
    name: "jack",
    height: undefined
  };
  const actual = fill(opts, { height: 20 });
  expect(actual).toStrictEqual({name: "jack", height: 20})
});

test("Supplied default should guarantee type existance", () => {
  type Expected = {
    name: string;
    direction: "up" | "down" | "left" | "right";
    highlight: boolean;
    animate?: boolean;
  };

  const opts: {
    name: string;
    direction: "up" | "down" | "left" | "right";
    highlight?: boolean;
    animate?: boolean;
  } = { name: "foo", direction: "up" };

  const actual = fill(opts, { highlight: false });

  expectType<Expected>(actual);
});

test("strings", () => {
  function filled(props: {
    name: string;
    direction: "up" | "down" | "left" | "right";
    highlight?: string;
    animate?: boolean;
  }) {
    // This should not end up narrowing to the fixed value
    return fill(props, { highlight: "fixed_string" });
  }
  let a = filled({ name: "foo", direction: "up" });
  expectType<string>(a.name);
  expectType<"up" | "down" | "left" | "right">(a.direction);
  expectType<string>(a.highlight);
  expectType<boolean | undefined>(a.animate);
});

// tsd expectError doesn't integrate into Jest
test("Errors", () => {
  /*
  function prop_typed_errors(props: {
    name: string;
    direction: "up" | "down" | "left" | "right";
    highlight?: boolean;
    animate?: boolean;
  }) {
    // Don't allow requireds to even be listed
    return fill(props, { name: "undefined", highlight: false });
  }
  */
});
