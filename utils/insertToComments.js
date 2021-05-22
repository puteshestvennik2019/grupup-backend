const insertToComments = (comments, parentId, commentId) => {
  const newObj = comments.forEach((item) => {
    if (item.id === parentId) {
      item.childComments.push({ id: commentId, childComments: [] });
      // could add a flag here to terminate the recursion
    } else {
      item.childComments = insertToComments(
        item.childComments,
        parentId,
        commentId
      );
    }
  });
  return comments;
};

module.exports = insertToComments;
