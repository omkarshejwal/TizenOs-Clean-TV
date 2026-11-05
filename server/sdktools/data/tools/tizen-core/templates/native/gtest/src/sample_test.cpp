#include <gtest/gtest.h>

class TestSuite : public testing::Test
{
	protected:
	// virtual void SetUp() will be called before each test is run.
	// You should define it if you need to initialize the variables.
	// Otherwise, you don't have to provide it.
	virtual void SetUp()
	{

	}
	// virtual void TearDown() will be called after each test is run.
	// You should define it if there is cleanup work to do.
	// Otherwise, you don't have to provide it.
	virtual void TearDown()
	{

	}
};

// When you have a test fixture, you define a test using TEST_F.
// Otherwise, you define a test using TEST.
TEST_F(TestSuite, test01)
{
	ASSERT_TRUE(true);
}

TEST_F(TestSuite, test02)
{
	ASSERT_TRUE(false);
}
