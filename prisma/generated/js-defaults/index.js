
            const jsDefaultsConfig = {
  "models": {
    "User": {
      "hash": "generateHash"
    },
    "Article": {
      "slug": "generateSlug"
    },
    "Comment": {
      "publicId": "generateCommentId"
    }
  },
  "relations": {
    "User": {
      "articles": "Article"
    },
    "Article": {
      "author": "User",
      "comments": "Comment"
    },
    "Comment": {
      "article": "Article"
    }
  }
};
            module.exports = { jsDefaultsConfig };
        