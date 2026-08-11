const { EleventyHtmlBasePlugin } = require("@11ty/eleventy");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Rewrites root-absolute URLs (href/src) with the path prefix, so the site
  // can deploy under a subpath such as GitHub Pages' /<repo>/.
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);

  return {
    pathPrefix: process.env.PATHPREFIX || "/",
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site"
    },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk"
  };
};
