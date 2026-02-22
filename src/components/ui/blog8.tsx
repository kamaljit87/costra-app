import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Card } from "@/components/ui/card";

interface Post {
  id: string;
  title: string;
  summary: string;
  label: string;
  author: string;
  published: string;
  url: string;
  image: string;
  tags?: string[];
}

interface Blog8Props {
  heading?: string;
  description?: string;
  posts?: Post[];
}

const Blog8 = ({
  heading = "Blog Posts",
  description = "Discover the latest insights and tutorials about modern web development, UI design, and component-driven architecture.",
  posts = [],
}: Blog8Props) => {
  return (
    <section className="py-8 md:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-8">
        <div className="text-center">
          <h2 className="mx-auto mb-2 text-pretty text-2xl font-semibold md:text-3xl lg:max-w-3xl">
            {heading}
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground text-sm md:text-base mt-1">
            {description}
          </p>
        </div>

        <div className="grid gap-y-8 sm:grid-cols-12 sm:gap-y-10 w-full">
          {posts.map((post) => (
            <Card
              key={post.id}
              className="order-last border-0 bg-transparent shadow-none sm:order-first sm:col-span-12 lg:col-span-10 lg:col-start-2"
            >
              <div className="grid gap-y-6 sm:grid-cols-10 sm:gap-x-5 sm:gap-y-0 md:items-center md:gap-x-8 lg:gap-x-12">
                <div className="sm:col-span-5">
                  <div className="mb-4 md:mb-6">
                    <div className="flex flex-wrap gap-3 text-xs uppercase tracking-wider text-muted-foreground md:gap-5 lg:gap-6">
                      {post.tags?.map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold md:text-2xl lg:text-3xl">
                    <Link
                      to={post.url}
                      className="hover:underline"
                    >
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-4 text-muted-foreground md:mt-5">
                    {post.summary}
                  </p>
                  <div className="mt-6 flex items-center space-x-4 text-sm md:mt-8">
                    <span className="text-muted-foreground">{post.author}</span>
                    <span className="text-muted-foreground">&bull;</span>
                    <span className="text-muted-foreground">
                      {post.published}
                    </span>
                  </div>
                  <div className="mt-6 flex items-center space-x-2 md:mt-8">
                    <Link
                      to={post.url}
                      className="inline-flex items-center font-semibold hover:underline md:text-base"
                    >
                      <span>Read more</span>
                      <ArrowRight className="ml-2 size-4 transition-transform" />
                    </Link>
                  </div>
                </div>
                <div className="order-first sm:order-last sm:col-span-5">
                  <Link to={post.url} className="block">
                    <div className="aspect-[16/9] overflow-clip rounded-lg border border-border">
                      <img
                        src={post.image}
                        alt={post.title}
                        className="h-full w-full object-cover transition-opacity duration-200 hover:opacity-70"
                      />
                    </div>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export { Blog8 };
export type { Post, Blog8Props };
