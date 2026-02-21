import { LoaderFunctionArgs, LinksFunction } from "react-router";

export type Route = {
  LoaderArgs: LoaderFunctionArgs;
  ComponentProps: {
    loaderData: {
      user: { id: string; name: string; email: string; locale: string; theme: string };
      locale: string;
      releaseDate: string;
      version: string;
    };
  };
};
