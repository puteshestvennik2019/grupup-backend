-- added for testing and writing queries


create table users(
    id varchar(32) primary key,
    read_posts uuid[] references posts(id)
);

create table users(
    id varchar(32) primary key,
    read_posts uuid[],
    upvoted uuid[],
    downvoted uuid[],
    groupups uuid[]
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
    comments jsonb,
    num_comments int
);

--if parentId is null, this is a comment to the post rather than a reply to another comment
create table comments(
    id uuid primary key,
    postId uuid not null,
    parentId uuid,
    html_text text,
    created bigint not null,
    author varchar(32) not null
);

insert into groupups (name, description, created, members, posts) 
    values (
        'I hate this job',
        'This is for people who do this job for the money only',
        trunc(extract(epoch from now())),
        array['auth0|60957ab8668f99007138da76'],
        array[]::uuid[])
    returning id, created;

update groupups set members = members || '{"twitter|1385136755565895683"}' where id = '1';   // append to array

select cardinality(members) from groupups where id = '1';   // return arr.length

insert into test (comments) values ('[{"id":"123", "comments":[]},{"id":"234", "comments":[{"id":"123", "comments":[]}]}]');

insert into test (id, comments) values(uuid_generate_v4(), 
Array[
    '{"id": "1", "comments": []}', 
    '{"id": "2", "comments": 
        Array["{"id": "3", "comments": []}"]
    }']);
