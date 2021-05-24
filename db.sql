-- To create tables

create table users(
    id varchar(32) primary key,
    read_posts uuid[],
    upvoted uuid[],
    downvoted uuid[],
    name varchar(64),
    groupups bigint[]
);

create table groupups(
    id serial primary key,
    name varchar(64) not null,
    description text not null,
    created bigint not null,
    members varchar(32)[],
    thumbnail bytea,
    posts uuid[]
);

create table posts(
    id uuid primary key,
    groupup_id bigint not null,
    title varchar(128) not null,
    html_text text,
    created bigint not null,
    author varchar(32) not null,
    comments jsonb[],               -- nested comments; comment tree, if you like
    num_comments int,
    score int,
    comments_array uuid[]           -- array of all comments for easy querying of the comments table
);

create table comments(
    id uuid primary key,
    post_id uuid not null,
    parent_id uuid,                  --if parent_id is null, this is a comment to the post rather than a reply to another comment
    html_text text,
    created bigint not null,
    author varchar(32) not null
);
